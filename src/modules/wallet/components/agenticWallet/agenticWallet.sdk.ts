import { PushChain, AgenticError, AgenticRevertError } from '@pushchain/core';
import type {
  AllowedCall,
  DecodedSolanaRule,
  ForeignChainNamespace,
  Pin,
  PresetCategory,
  PresetRuleTemplate,
  Rule,
  RulesRecord,
} from '@pushchain/core';
import { PublicKey } from '@solana/web3.js';
import type { MoveableToken } from '@pushchain/core/src/lib/constants';
import type { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import {
  formatEther,
  formatUnits,
  getAddress,
  hexToBytes,
  maxUint256,
  parseEther,
  parseUnits,
  sha256,
  toHex,
  zeroAddress,
} from 'viem';
import { AGENTIC_APPS, AGENTIC_NETWORKS, NO_EXPIRY } from './agenticWallet.constants';
import { functionSelector } from './agenticWallet.functions';
import { fetchTokenInfo } from './agenticWallet.explorer';
import { registry } from './agenticWallet.storage';
import { AgenticNetwork, AgenticRule, RuleApp, RuleToken, RuleTokenRef } from './agenticWallet.types';
import { getApp, getNetwork, isRuleAppEmpty, isSolanaNetwork, ruleAppsKey } from './agenticWallet.utils';

/*
 * Translation between the rule screens and the AGW SDK (`client.agentic`).
 *
 * One UI rule is one SDK Rule on a foreign chain: the network is its chainNamespace, every
 * (app contract, function) pair becomes an allowedCalls entry, each token row an asset
 * cap, and the duration its validUntil. Blank limits mean unlimited; the SDK reads an
 * omitted maxTotal as zero, so unlimited is sent as uint256 max explicitly.
 */

const DAY_SECONDS = 86_400;

export class AgenticInputError extends Error {}

const moveableTokens = (network: AgenticNetwork): MoveableToken[] =>
  PushChain.utils.tokens.getMoveableTokens(network.chain as CHAIN).tokens as MoveableToken[];

/** Tokens offered for a network: the SDK's moveable list, then the owner's custom tokens. */
export const getNetworkTokens = (networkId: string): RuleTokenRef[] => {
  const network = getNetwork(networkId);
  const sdkTokens = moveableTokens(network).map((t) => ({
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
  }));
  const custom = (registry.get().tokens[networkId] ?? []).filter(
    (c) => !sdkTokens.some((t) => t.address.toLowerCase() === c.address.toLowerCase()),
  );
  return [...sdkTokens, ...custom];
};

const findToken = (networkId: string, address: string) =>
  getNetworkTokens(networkId).find((t) => t.address.toLowerCase() === address.toLowerCase());

/**
 * Makes tokens the SDK names by address alone (preset defaults such as Circle USDC or
 * Aave faucet tokens) known by symbol and decimals: looked up on the explorer or the
 * chain, then kept with the owner's custom tokens. Tokens that can't be resolved stay
 * unknown, so their limits are never read with guessed decimals.
 */
export const resolveTokens = async (networkId: string, addresses: string[]) => {
  const network = getNetwork(networkId);
  const unknown = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => !findToken(networkId, a));
  const found = await Promise.all(unknown.map((address) => fetchTokenInfo(network, address)));
  found.forEach((token) => token && registry.saveToken(networkId, token));
};

/** The first stablecoin the chain moves, so a new rule starts with something sensible. */
export const defaultToken = (networkId: string): RuleTokenRef | null => {
  const tokens = getNetworkTokens(networkId);
  return tokens.find((t) => t.symbol === 'USDC') ?? tokens[0] ?? null;
};

const parseAmount = (value: string, decimals: number, field: string) => {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  try {
    return parseUnits(cleaned, decimals);
  } catch {
    throw new AgenticInputError(`${field} "${value}" is not a valid amount.`);
  }
};

const appTarget = (ruleApp: RuleApp, network: AgenticNetwork) => {
  if (ruleApp.customContract) return getAddress(ruleApp.customContract);
  const app = getApp(ruleApp.appId);
  const contract = app?.contracts?.[network.id];
  if (!app || !contract) {
    throw new AgenticInputError(
      `${app?.name ?? 'This app'} has no contract configured on ${network.name} yet. Add it as a custom contract instead.`,
    );
  }
  return (network.vm === 'svm' ? contract : getAddress(contract)) as `0x${string}`;
};

const appSignatures = (ruleApp: RuleApp) => {
  const app = getApp(ruleApp.appId);
  const catalog = ruleApp.functionIds.map((id) => {
    const fn = app?.functions.find((f) => f.id === id);
    if (!fn?.signature) {
      throw new AgenticInputError(
        `"${fn?.label ?? id}" on ${app?.name ?? 'this app'} has no function signature configured yet.`,
      );
    }
    return fn.signature;
  });
  return [...catalog, ...(ruleApp.customFunctions ?? [])];
};

/* Days shown for a granted rule's expiry, rounded up so a rule never looks shorter than it is. */
export const durationFromValidUntil = (validUntil: number) =>
  validUntil >= NO_EXPIRY
    ? ''
    : String(Math.max(0, Math.ceil((validUntil - Date.now() / 1000) / DAY_SECONDS)));

/*
 * Expiry to grant. A granted rule whose duration field was left as loaded keeps its exact
 * on-chain validUntil; recomputing "now + days" would move it by the rounding.
 */
const resolveValidUntil = (rule: AgenticRule) => {
  if (rule.validUntil !== undefined && rule.durationDays === durationFromValidUntil(rule.validUntil)) {
    return rule.validUntil;
  }
  const days = Number(rule.durationDays);
  return rule.durationDays.trim() && days > 0
    ? Math.floor(Date.now() / 1000) + Math.round(days * DAY_SECONDS)
    : NO_EXPIRY;
};

/* Pins are keyed by selector; a stored rule may only know a function by its 4-byte id. */
const selectorKey = (signature: string) =>
  /^0x[0-9a-fA-F]{8}$/.test(signature) ? signature.toLowerCase() : functionSelector(signature)?.toLowerCase();

/*
 * Calls for catalog functions, as `presets.get` generates them. Presets send only ETH
 * from Push (any other token throws), so a rule's own ETH limits set the caps when it has
 * an ETH token; otherwise the preset's default ETH limits do. The calls keep the preset's
 * pins (the app's own WETH, the wallet as beneficiary), whatever else the rule allows.
 */
const presetCompiler = (network: AgenticNetwork, assets: NonNullable<Rule['assets']>) => {
  const generated = new Map<PresetCategory, AllowedCall[]>();
  const key = (target: string, selector: string) => `${target.toLowerCase()}:${selector}`;
  const eth = assets.find((asset) => isNativeAsset(asset) && asset.maxPerCall > 0n && (asset.maxTotal ?? 0n) > 0n);

  return (preset: PresetCategory, target: string, selector: string, name: string): AllowedCall[] => {
    let calls = generated.get(preset);
    if (!calls) {
      const { rules } = PushChain.utils.agentic.presets.get(preset, {
        chainNamespace: network.chain as ForeignChainNamespace,
        ...(eth ? { assets: [{ token: eth.token, maxPerCall: eth.maxPerCall, maxTotal: eth.maxTotal ?? 0n }] } : {}),
      });
      calls = rules.flatMap((r) => r.allowedCalls);
      generated.set(preset, calls);
    }
    const matching = calls.filter((call) => key(call.target, call.selector) === key(target, selector));
    if (!matching.length) throw new AgenticInputError(`${name} isn't available on ${network.name} yet.`);
    return matching;
  };
};

const U64_MAX = 2n ** 64n - 1n;

/*
 * Solana instructions from the listed programs, with the account pins the list gives
 * (where the wallet sits in each instruction). An instruction that moves SOL also has
 * its amount argument capped at the rule's SOL per transaction limit: Solana has no
 * per-call value cap, and token limits only meter what is sent from Push.
 */
const solanaCalls = (rule: AgenticRule, network: AgenticNetwork, assets: Rule['assets'] = []): AllowedCall[] => {
  const sol = assets.find((asset) => (typeof asset.token === 'string' ? asset.token : asset.token.address) === zeroAddress);
  return rule.apps.flatMap((ruleApp) => {
    const app = getApp(ruleApp.appId);
    if (!app || ruleApp.customContract || ruleApp.customFunctions?.length) {
      throw new AgenticInputError(`Only listed apps can be used on ${network.name} for now.`);
    }
    const target = appTarget(ruleApp, network);
    return ruleApp.functionIds.map((id) => {
      const fn = app.functions.find((f) => f.id === id);
      if (!fn?.signature) throw new AgenticInputError(`"${fn?.label ?? id}" on ${app.name} has no instruction configured yet.`);
      const pins: Pin[] = [...(fn.pins ?? [])];
      if (fn.amountArg !== undefined) {
        if (!sol) throw new AgenticInputError(`${fn.label} on ${app.name} needs SOL in Allowed Tokens to cap its amount.`);
        pins.push({ arg: fn.amountArg, max: sol.maxPerCall > U64_MAX ? U64_MAX : sol.maxPerCall });
      }
      return { target, selector: fn.signature as AllowedCall['selector'], pins } as AllowedCall;
    });
  });
};

/* A rule's token rows as SDK assets: moveable tokens as the SDK's own objects, blank limits as unlimited. */
const ruleAssets = (rule: AgenticRule): NonNullable<Rule['assets']> => {
  const tokens = moveableTokens(getNetwork(rule.networkId));
  return rule.tokens.map((row, index) => {
    if (!row.token) throw new AgenticInputError(`Token ${index + 1} is not selected.`);
    const { address, decimals, symbol } = row.token;
    const sdkToken = tokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
    return {
      // Solana tokens are base58 mints; only the SDK's moveable tokens are offered there.
      token: sdkToken ?? (isSolanaNetwork(rule.networkId) ? address : (getAddress(address) as `0x${string}`)),
      maxPerCall: parseAmount(row.perTxLimit, decimals, `${symbol} per transaction limit`) ?? maxUint256,
      maxTotal: parseAmount(row.totalLimit, decimals, `${symbol} total spend limit`) ?? maxUint256,
    };
  });
};

const isNativeAsset = (asset: NonNullable<Rule['assets']>[number]) =>
  (typeof asset.token === 'string' ? asset.token : (asset.token as { address?: string }).address) === zeroAddress;

/* Moveable token constant meaning "every token Push can send to this chain, at default limits". */
const allTokens = (network: AgenticNetwork) =>
  Object.values(PushChain.CONSTANTS.MOVEABLE.TOKEN).find(
    (tokens) => (tokens as { ALL?: { chain?: string } }).ALL?.chain === network.chain,
  ) as unknown as { ALL: NonNullable<Rule['assets']>[number]['token'] } | undefined;

/*
 * A preset draft whose apps the owner hasn't changed and whose only token is ETH is
 * regenerated from the preset: every cap (wrap value, approvals, swap and supply amounts)
 * follows the ETH limits, as the SDK asks. Anything else is built as a custom rule.
 */
const regeneratedPreset = (
  rule: AgenticRule,
  network: AgenticNetwork,
  assets: NonNullable<Rule['assets']>,
  validUntil: number,
  maxGasPerCall: bigint,
): Rule | null => {
  if (!rule.preset || rule.presetApps !== ruleAppsKey(rule.apps)) return null;
  if (assets.length !== 1 || !isNativeAsset(assets[0])) return null;
  const { rules } = PushChain.utils.agentic.presets.get(rule.preset, {
    chainNamespace: network.chain as ForeignChainNamespace,
    agent: getAddress(rule.agentAddress) as `0x${string}`,
    validUntil,
    maxGasPerCall,
    assets: [{ token: assets[0].token, maxPerCall: assets[0].maxPerCall, maxTotal: assets[0].maxTotal ?? 0n }],
  });
  return rules[0] ?? null;
};

export const toSdkRule = (rule: AgenticRule): Rule => {
  const network = getNetwork(rule.networkId);
  const assets = ruleAssets(rule);
  const validUntil = resolveValidUntil(rule);

  let maxGasPerCall: bigint;
  try {
    maxGasPerCall = parseEther((rule.maxGasPerCall || network.defaultGasPerCall).replace(/,/g, ''));
  } catch {
    throw new AgenticInputError(`Max gas per call "${rule.maxGasPerCall}" is not a valid PC amount.`);
  }

  const preset = regeneratedPreset(rule, network, assets, validUntil, maxGasPerCall);
  if (preset) return preset;

  const apps = rule.apps.filter((ruleApp) => !isRuleAppEmpty(ruleApp));
  const solana = isSolanaNetwork(rule.networkId);
  const compilePreset = presetCompiler(network, assets);
  const allowedCalls: AllowedCall[] = solana
    ? solanaCalls({ ...rule, apps }, network, assets)
    : apps.flatMap((ruleApp) => {
        const target = appTarget(ruleApp, network);
        const app = getApp(ruleApp.appId);
        return appSignatures(ruleApp).flatMap((selector): AllowedCall[] => {
          const catalogFn = app?.functions.find((fn) => fn.signature === selector);
          // A catalog function comes from its preset, with the preset's pins and caps.
          if (catalogFn?.preset) return compilePreset(catalogFn.preset, target, selector, `${catalogFn.label} on ${app?.name}`);
          const pins = ruleApp.pins?.[selectorKey(selector) ?? ''];
          const maxValue = ruleApp.maxValues?.[selectorKey(selector) ?? ''];
          return [
            {
              target,
              selector: selector as AllowedCall['selector'],
              ...(pins?.length ? { pins } : {}),
              ...(maxValue ? { maxValue } : {}),
            },
          ];
        });
      });
  // A function picked twice (or under two apps on one contract) must not grant its calls twice.
  const seen = new Set<string>();
  const uniqueCalls = allowedCalls.filter((call) => {
    const key = JSON.stringify(call, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Without an app, an EVM rule lets the agent send its tokens back to the owner only (the SDK adds those transfers).
  if (!uniqueCalls.length && solana) throw new AgenticInputError(`Add at least one app on ${network.name}.`);
  if (uniqueCalls.length > 32) throw new AgenticInputError('A rule can allow at most 32 app functions.');

  // No tokens selected means every token Push can send to this chain, each at the SDK's default limits.
  const all = allTokens(network);
  if (!assets.length && !all) throw new AgenticInputError(`Select at least one token on ${network.name}.`);

  return {
    agent: getAddress(rule.agentAddress) as `0x${string}`,
    chainNamespace: network.chain as ForeignChainNamespace,
    assets: assets.length ? assets : [{ token: all!.ALL } as NonNullable<Rule['assets']>[number]],
    maxGasPerCall,
    validUntil,
    allowedCalls: uniqueCalls,
  };
};

/*
 * What "no tokens selected" expands to on a network, as the SDK will grant it: every
 * token Push can send there at its default limits (native ETH/BNB only when the rule has
 * an app). Shown on the review before signing.
 */
export const allTokenLimits = (rule: AgenticRule): RuleToken[] => {
  const network = getNetwork(rule.networkId);
  let expanded: { token: { address?: string } | string; maxPerCall: bigint; maxTotal?: bigint }[] = [];
  try {
    expanded = PushChain.utils.agentic.assets.all(network.chain as ForeignChainNamespace) as typeof expanded;
  } catch {
    return [];
  }
  const withApps = rule.apps.some((ruleApp) => !isRuleAppEmpty(ruleApp));
  const rows = expanded.flatMap((asset) => {
    const address = typeof asset.token === 'string' ? asset.token : asset.token.address ?? '';
    if (!withApps && address === zeroAddress) return [];
    const token = findToken(network.id, address);
    if (!token) return [];
    return [{ token, totalLimit: formatLimit(asset.maxTotal, token.decimals), perTxLimit: formatLimit(asset.maxPerCall, token.decimals) }];
  });
  return rows;
};

const formatLimit = (value: bigint | undefined, decimals: number) =>
  value === undefined || value === maxUint256 ? '' : formatUnits(value, decimals);

/* Full signatures the SDK presets use on a contract, by network: stored rules keep only 4-byte selectors. */
const presetSignatureCache = new Map<string, Map<string, string[]>>();
const presetSignatures = (networkId: string, target: string): string[] => {
  let byTarget = presetSignatureCache.get(networkId);
  if (!byTarget) {
    byTarget = new Map();
    const network = getNetwork(networkId);
    try {
      const { presets } = PushChain.utils.agentic;
      presets
        .list()
        .presets.filter((preset) => preset.chains.some((chain) => chain === network.chain))
        .forEach((preset) =>
          presets
            .get(preset.constant, { chainNamespace: network.chain as ForeignChainNamespace })
            .rules.flatMap((r) => r.allowedCalls)
            .forEach((call) => {
              if (!call.selector.includes('(')) return;
              const key = call.target.toLowerCase();
              byTarget!.set(key, [...new Set([...(byTarget!.get(key) ?? []), call.selector])]);
            }),
        );
    } catch {
      // No presets for this network
    }
    presetSignatureCache.set(networkId, byTarget);
  }
  return byTarget.get(target.toLowerCase()) ?? [];
};

/** Groups allowedCalls back into apps, naming them from the catalog or the custom registry. */
const decodeApps = (networkId: string, calls: readonly AllowedCall[]): RuleApp[] => {
  const byTarget = new Map<string, AllowedCall[]>();
  calls.forEach((call) => {
    const key = call.target.toLowerCase();
    byTarget.set(key, [...(byTarget.get(key) ?? []), call]);
  });

  return Array.from(byTarget.entries()).map(([target, targetCalls]) => {
    const app = AGENTIC_APPS.find((a) => a.contracts?.[networkId]?.toLowerCase() === target);
    const known = (app?.functions ?? []).filter((f) => f.signature);
    // Signatures known for this contract: saved under the app, under its address before the app was listed,
    // or from a preset that calls it (e.g. Aave's own WETH reserve).
    const customSignatures = [
      ...registry.getFunctions(networkId, app?.id ?? target),
      ...(app ? registry.getFunctions(networkId, target) : []),
      ...presetSignatures(networkId, target),
    ];

    const functionIds: string[] = [];
    const customFunctions: string[] = [];
    const pins: Record<string, Pin[]> = {};
    const maxValues: Record<string, bigint> = {};
    targetCalls.forEach((call) => {
      const selector = selectorKey(call.selector) ?? call.selector.toLowerCase();
      if (call.pins?.length) pins[selector] = call.pins;
      if (call.maxValue) maxValues[selector] = call.maxValue;
      const catalogFn = known.find((f) => functionSelector(f.signature!)?.toLowerCase() === selector);
      if (catalogFn) {
        // A preset sends one call per token direction for the same function; it is selected once
        // and toSdkRule regenerates every direction from the rule's tokens.
        if (!functionIds.includes(catalogFn.id)) functionIds.push(catalogFn.id);
        return;
      }
      // A full signature (from a preset) is kept; a stored 4-byte id is named from the registry when known.
      const custom = call.selector.includes('(')
        ? call.selector
        : customSignatures.find((sig) => functionSelector(sig)?.toLowerCase() === selector);
      // Unknown selectors stay visible as their 4-byte id rather than being dropped.
      if (!customFunctions.includes(custom ?? call.selector)) customFunctions.push(custom ?? call.selector);
    });

    const extra = {
      ...(Object.keys(pins).length ? { pins } : {}),
      ...(Object.keys(maxValues).length ? { maxValues } : {}),
    };
    return app
      ? { appId: app.id, functionIds, customFunctions, ...extra }
      : { appId: null, functionIds, customContract: getAddress(target), customFunctions, ...extra };
  });
};

/* An Anchor instruction's discriminator: sha256("global:<snake_case name>"), first 8 bytes; raw ones as given. */
const instructionDiscriminator = (signature: string) => {
  // A raw eight-byte discriminator (e.g. a memo prefix) is already the stored form.
  if (/^0x[0-9a-fA-F]{16}$/.test(signature)) return signature.toLowerCase();
  const name = signature.split('(')[0].replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return sha256(toHex(`global:${name}`)).slice(0, 18);
};

/*
 * A Solana rule comes back in its stored form: program keys and instruction
 * discriminators, no names. It is shown (and can be edited) only when every instruction
 * is one the listed programs know; an edit regenerates the same pins from that list.
 * Anything else stays unsupported, so its raw constraints are never rewritten.
 */
const fromSolanaRecord = (record: RulesRecord, rule: DecodedSolanaRule, network: AgenticNetwork): AgenticRule | null => {
  const apps = new Map<string, string[]>();
  for (const program of rule.programs) {
    let programId: string;
    try {
      programId = new PublicKey(hexToBytes(program.program)).toBase58();
    } catch {
      return null;
    }
    const app = AGENTIC_APPS.find((a) => a.contracts?.[network.id] === programId);
    const discriminator = program.discriminator.slice(0, 2 + program.discriminatorLen * 2).toLowerCase();
    const fn = app?.functions.find((f) => f.signature && instructionDiscriminator(f.signature) === discriminator);
    if (!app || !fn) return null;
    apps.set(app.id, [...(apps.get(app.id) ?? []), fn.id]);
  }

  const tokens: RuleToken[] = rule.assets
    .filter((asset) => !(asset.maxPerCall === 0n && asset.maxTotal === 0n))
    .map((asset) => {
      const token = findToken(network.id, asset.token) ?? { address: asset.token, symbol: `${asset.token.slice(0, 6)}…`, decimals: 9 };
      return { token, totalLimit: formatLimit(asset.maxTotal, token.decimals), perTxLimit: formatLimit(asset.maxPerCall, token.decimals) };
    });

  return {
    id: record.rulesId,
    rulesId: record.rulesId,
    networkId: network.id,
    apps: [...apps.entries()].map(([appId, functionIds]) => ({ appId, functionIds })),
    tokens,
    maxGasPerCall: formatEther(rule.maxGasPerCall),
    agentAddress: record.agent,
    durationDays: durationFromValidUntil(record.validUntil),
    validUntil: record.validUntil,
  };
};

/*
 * The transfer(address,uint256) the SDK adds on each token's own contract for a rule
 * without apps (the agent may send that token back to the owner). It belongs to the
 * tokens, not an app, and is added again when the rule is saved without apps.
 */
const isTokenReturnTransfer = (call: AllowedCall, assets: NonNullable<Rule['assets']>) =>
  (call.selector === 'transfer(address,uint256)' || call.selector.toLowerCase() === '0xa9059cbb') &&
  assets.some((asset) => {
    const address = typeof asset.token === 'string' ? asset.token : asset.token.address;
    return address.toLowerCase() === call.target.toLowerCase();
  });

/*
 * On-chain rules don't record which preset made them. A rule whose calls are exactly a
 * preset's (same contracts and functions) is treated as that preset again, so editing its
 * ETH limits regenerates every cap from the preset instead of keeping stale ones.
 */
const matchingPreset = (network: AgenticNetwork, calls: readonly AllowedCall[]): PresetCategory | undefined => {
  const shape = (list: readonly { target: string; selector: string }[]) =>
    [...new Set(list.map((call) => `${call.target.toLowerCase()}:${selectorKey(call.selector)}`))].sort().join('|');
  const ruleShape = shape(calls);
  try {
    const { presets } = PushChain.utils.agentic;
    return presets
      .list()
      .presets.filter((preset) => preset.chains.some((chain) => chain === network.chain))
      .find((preset) => {
        const { rules } = presets.get(preset.constant, { chainNamespace: network.chain as ForeignChainNamespace });
        return shape(rules.flatMap((r) => r.allowedCalls)) === ruleShape;
      })?.constant;
  } catch {
    return undefined;
  }
};

/** A granted rule as the screens show it, or null for rule kinds the screens do not support yet. */
export const fromRulesRecord = (record: RulesRecord): AgenticRule | null => {
  const network = AGENTIC_NETWORKS.find((n) => n.chain === record.chainNamespace);
  if (network?.vm === 'svm' && 'format' in record.rule) return fromSolanaRecord(record, record.rule, network);
  const rule = record.rule as Rule;
  // Push-native rules (no chainNamespace) and decoded Solana layouts are not editable here yet.
  if (!network || !rule.chainNamespace || !Array.isArray(rule.allowedCalls) || !Array.isArray(rule.assets)) return null;

  // A rule granted without tokens comes back with a zero-cap gas-token entry the SDK added; it moves nothing.
  const assets = rule.assets.filter((asset) => !(asset.maxPerCall === 0n && (asset.maxTotal ?? 0n) === 0n));
  const tokens: RuleToken[] = assets.map((asset) => {
    const address = typeof asset.token === 'string' ? asset.token : asset.token.address;
    const token = findToken(network.id, address) ?? { address, symbol: `${address.slice(0, 6)}…`, decimals: 18 };
    return {
      token,
      totalLimit: formatLimit(asset.maxTotal, token.decimals),
      perTxLimit: formatLimit(asset.maxPerCall, token.decimals),
    };
  });

  const calls = rule.allowedCalls.filter((call) => !isTokenReturnTransfer(call, assets));
  const apps = decodeApps(network.id, calls);
  const preset = matchingPreset(network, calls);

  return {
    ...(preset ? { preset, presetApps: ruleAppsKey(apps) } : {}),
    id: record.rulesId,
    rulesId: record.rulesId,
    networkId: network.id,
    apps,
    tokens,
    maxGasPerCall: formatEther(rule.maxGasPerCall ?? 0n),
    agentAddress: record.agent,
    durationDays: durationFromValidUntil(record.validUntil),
    validUntil: record.validUntil,
  };
};

/*
 * A preset template as a rule draft. Its apps arrive as custom contracts named by the
 * template, and its function labels ("Supply", "Swap exact input") are saved so later
 * screens show them. Assets come only from the template: a preset never gains a default
 * token with unlimited caps. Gas falls back to the network default.
 */
export const fromPresetTemplate = (
  template: PresetRuleTemplate,
  draftId: string,
  durationDays: string,
): AgenticRule | null => {
  const network = AGENTIC_NETWORKS.find((n) => n.chain === template.chainNamespace);
  if (!network) return null;

  template.allowedCalls.forEach((call) => {
    // Contracts the catalog already knows (from the SDK) are not saved again as custom apps.
    const inCatalog = AGENTIC_APPS.some((a) => a.contracts?.[network.id]?.toLowerCase() === call.target.toLowerCase());
    if (call.app && !inCatalog && !registry.getApp(network.id, call.target)) {
      registry.saveApp(network.id, { address: getAddress(call.target), name: call.app });
    }
    const selector = selectorKey(call.selector);
    if (call.label && selector) registry.saveFunctionLabel(network.id, call.target, selector, call.label);
  });

  const tokens: RuleToken[] = (template.assets ?? []).map((asset) => {
    const address = typeof asset.token === 'string' ? asset.token : asset.token.address;
    const token = findToken(network.id, address) ?? null;
    const decimals = token?.decimals ?? 18;
    return {
      token,
      totalLimit: formatLimit(asset.maxTotal, decimals),
      perTxLimit: formatLimit(asset.maxPerCall, decimals),
    };
  });

  return {
    id: draftId,
    networkId: network.id,
    apps: decodeApps(network.id, template.allowedCalls),
    tokens,
    maxGasPerCall:
      template.maxGasPerCall !== undefined ? formatEther(template.maxGasPerCall) : network.defaultGasPerCall,
    agentAddress: template.agent ?? '',
    // The SDK's generated expiry (seven days for presets) wins over the caller's default.
    durationDays:
      template.validUntil !== undefined
        ? String(Math.max(1, Math.ceil((template.validUntil - Date.now() / 1000) / DAY_SECONDS)))
        : durationDays,
  };
};

/** A message the owner can act on, from SDK, contract or input errors. */
export const describeAgenticError = (error: unknown): string => {
  if (error instanceof AgenticInputError) return error.message;
  // The SDK's own text for people (rule-numbered, no RPC or ABI detail); code/message/details stay for diagnostics.
  const userMessage = (error as { userMessage?: unknown } | null)?.userMessage;
  if ((error instanceof AgenticError || error instanceof AgenticRevertError) && typeof userMessage === 'string' && userMessage) {
    if (/user rejected|denied/i.test((error as Error).message)) return 'The request was rejected in your wallet.';
    return userMessage;
  }
  if (error instanceof AgenticRevertError) {
    const decoded = (error as { decodedError?: { errorName?: string } }).decodedError?.errorName;
    return decoded ? `The contract rejected this change (${decoded}).` : error.message;
  }
  if (error instanceof AgenticError) return error.hint ? `${error.message} ${error.hint}` : error.message;
  if (error instanceof Error) {
    if (/user rejected|denied/i.test(error.message)) return 'The request was rejected in your wallet.';
    // RPC failures (e.g. the node rate-limiting with HTTP 429) carry the whole request in their message.
    if (/HTTP request failed|Failed to fetch|fetch failed|429|Too Many Requests|timed? ?out/i.test(error.message)) {
      return "Push Chain's network didn't respond. Nothing was signed; please try again in a moment.";
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};

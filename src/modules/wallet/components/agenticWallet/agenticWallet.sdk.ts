import { PushChain, AgenticError, AgenticRevertError } from '@pushchain/core';
import type { AllowedCall, Pin, PresetRuleTemplate, Rule, RulesRecord } from '@pushchain/core';
import type { MoveableToken } from '@pushchain/core/src/lib/constants';
import type { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { formatEther, formatUnits, getAddress, maxUint256, parseEther, parseUnits } from 'viem';
import { AGENTIC_APPS, AGENTIC_NETWORKS, NO_EXPIRY } from './agenticWallet.constants';
import { functionSelector } from './agenticWallet.functions';
import { registry } from './agenticWallet.storage';
import { AgenticNetwork, AgenticRule, RuleApp, RuleToken, RuleTokenRef } from './agenticWallet.types';
import { getApp, getNetwork } from './agenticWallet.utils';

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
  return getAddress(contract);
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

export const toSdkRule = (rule: AgenticRule): Rule => {
  const network = getNetwork(rule.networkId);
  const tokens = moveableTokens(network);

  const assets = rule.tokens.map((row, index) => {
    if (!row.token) throw new AgenticInputError(`Token ${index + 1} is not selected.`);
    const { address, decimals, symbol } = row.token;
    const sdkToken = tokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
    return {
      token: sdkToken ?? (getAddress(address) as `0x${string}`),
      maxPerCall: parseAmount(row.perTxLimit, decimals, `${symbol} per transaction limit`) ?? maxUint256,
      maxTotal: parseAmount(row.totalLimit, decimals, `${symbol} total spend limit`) ?? maxUint256,
    };
  });

  const allowedCalls: AllowedCall[] = rule.apps.flatMap((ruleApp) => {
    const target = appTarget(ruleApp, network);
    return appSignatures(ruleApp).map((selector) => {
      const pins = ruleApp.pins?.[selectorKey(selector) ?? ''];
      return { target, selector: selector as AllowedCall['selector'], ...(pins?.length ? { pins } : {}) };
    });
  });
  if (!allowedCalls.length) throw new AgenticInputError('Add at least one app function.');
  if (allowedCalls.length > 32) throw new AgenticInputError('A rule can allow at most 32 app functions.');

  const validUntil = resolveValidUntil(rule);

  let maxGasPerCall: bigint;
  try {
    maxGasPerCall = parseEther((rule.maxGasPerCall || network.defaultGasPerCall).replace(/,/g, ''));
  } catch {
    throw new AgenticInputError(`Max gas per call "${rule.maxGasPerCall}" is not a valid PC amount.`);
  }

  return {
    agent: getAddress(rule.agentAddress) as `0x${string}`,
    chainNamespace: network.chain as `eip155:${string}`,
    assets,
    maxGasPerCall,
    validUntil,
    allowedCalls,
  };
};

const formatLimit = (value: bigint | undefined, decimals: number) =>
  value === undefined || value === maxUint256 ? '' : formatUnits(value, decimals);

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
    const customSignatures = registry.getFunctions(networkId, app?.id ?? target);

    const functionIds: string[] = [];
    const customFunctions: string[] = [];
    const pins: Record<string, Pin[]> = {};
    targetCalls.forEach((call) => {
      const selector = selectorKey(call.selector) ?? call.selector.toLowerCase();
      if (call.pins?.length) pins[selector] = call.pins;
      const catalogFn = known.find((f) => functionSelector(f.signature!)?.toLowerCase() === selector);
      if (catalogFn) {
        functionIds.push(catalogFn.id);
        return;
      }
      // A full signature (from a preset) is kept; a stored 4-byte id is named from the registry when known.
      const custom = call.selector.includes('(')
        ? call.selector
        : customSignatures.find((sig) => functionSelector(sig)?.toLowerCase() === selector);
      // Unknown selectors stay visible as their 4-byte id rather than being dropped.
      customFunctions.push(custom ?? call.selector);
    });

    const extra = Object.keys(pins).length ? { pins } : {};
    return app
      ? { appId: app.id, functionIds, customFunctions, ...extra }
      : { appId: null, functionIds, customContract: getAddress(target), customFunctions, ...extra };
  });
};

/** A granted rule as the screens show it, or null for rule kinds the screens do not support yet. */
export const fromRulesRecord = (record: RulesRecord): AgenticRule | null => {
  const network = AGENTIC_NETWORKS.find((n) => n.chain === record.chainNamespace);
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

  return {
    id: record.rulesId,
    rulesId: record.rulesId,
    networkId: network.id,
    apps: decodeApps(network.id, rule.allowedCalls),
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
    if (call.app && !registry.getApp(network.id, call.target)) {
      registry.saveApp(network.id, { address: getAddress(call.target), name: call.app });
    }
    if (call.selector.includes('(')) registry.saveFunctions(network.id, call.target, [call.selector]);
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
    durationDays,
  };
};

/** A message the owner can act on, from SDK, contract or input errors. */
export const describeAgenticError = (error: unknown): string => {
  if (error instanceof AgenticInputError) return error.message;
  if (error instanceof AgenticRevertError) {
    const decoded = (error as { decodedError?: { errorName?: string } }).decodedError?.errorName;
    return decoded ? `The contract rejected this change (${decoded}).` : error.message;
  }
  if (error instanceof AgenticError) return error.hint ? `${error.message} ${error.hint}` : error.message;
  if (error instanceof Error) {
    if (/user rejected|denied/i.test(error.message)) return 'The request was rejected in your wallet.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};

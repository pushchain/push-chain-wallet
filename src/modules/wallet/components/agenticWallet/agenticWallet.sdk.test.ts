import { describe, expect, it, vi } from 'vitest';
import { getAddress, maxUint256, sha256, toHex } from 'viem';
import { PublicKey } from '@solana/web3.js';
import { PushChain } from '@pushchain/core';
import type { PresetRuleTemplate, Rule, RulesRecord } from '@pushchain/core';
import { NO_EXPIRY } from './agenticWallet.constants';
import {
  AgenticInputError,
  fromPresetTemplate,
  fromRulesRecord,
  getNetworkTokens,
  presetReadinessIssues,
  toSdkRule,
} from './agenticWallet.sdk';
import { AgenticRule } from './agenticWallet.types';
import {
  findAmbiguousRules,
  findDuplicateToken,
  formatExpiresIn,
  formatTokenLimits,
  getRuleFunctionLabels,
  isRuleStepTwoValid,
} from './agenticWallet.utils';
import { getAgenticPresets } from './agenticWallet.rules';
import { getApp, getNetwork } from './agenticWallet.utils';

const AGENT = getAddress('0x9cfa1c55e8b23fb4c2a3e2d55d0b1c7b0ae4ebdc');
// A contract outside the catalog, used as a custom app
const ROUTER = getAddress('0x1111111111111111111111111111111111111111');
const UNISWAP_SEPOLIA = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';
const AAVE_USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const CIRCLE_USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Token lookups go to the explorer; answer them locally.
vi.mock('./agenticWallet.explorer', () => ({
  fetchTokenInfo: async (_network: unknown, address: string) =>
    [CIRCLE_USDC_SEPOLIA, CIRCLE_USDC_BASE_SEPOLIA].find((a) => a.toLowerCase() === address.toLowerCase())
      ? { address, symbol: 'USDC', decimals: 6 }
      : null,
  fetchContractInfo: async () => ({}),
}));

const usdc = () => getNetworkTokens('ethereum').find((t) => t.symbol === 'USDC')!;

const draft = (overrides: Partial<AgenticRule> = {}): AgenticRule => ({
  id: 'draft-1',
  networkId: 'ethereum',
  apps: [{ appId: null, functionIds: [], customContract: ROUTER, customFunctions: ['multicall(bytes[])'] }],
  tokens: [{ token: usdc(), totalLimit: '1,000', perTxLimit: '100' }],
  maxGasPerCall: '0.1',
  agentAddress: AGENT,
  durationDays: '30',
  ...overrides,
});

describe('toSdkRule', () => {
  it('maps a rule onto the SDK Rule', () => {
    const rule = toSdkRule(draft());
    expect(rule.chainNamespace).toBe('eip155:11155111');
    expect(rule.agent).toBe(AGENT);
    expect(rule.allowedCalls).toEqual([{ target: ROUTER, selector: 'multicall(bytes[])' }]);
    expect(rule.assets).toHaveLength(1);
    expect(rule.assets![0].maxPerCall).toBe(100_000_000n); // 100 USDC at 6 decimals
    expect(rule.assets![0].maxTotal).toBe(1_000_000_000n);
    expect(rule.maxGasPerCall).toBe(100_000_000_000_000_000n);
    const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 86_400;
    expect(Math.abs(rule.validUntil - thirtyDays)).toBeLessThan(5);
  });

  it('treats blank limits and duration as unlimited', () => {
    const rule = toSdkRule(draft({ tokens: [{ token: usdc(), totalLimit: '', perTxLimit: '' }], durationDays: '' }));
    expect(rule.assets![0].maxPerCall).toBe(maxUint256);
    // The SDK reads an omitted maxTotal as zero, so unlimited must be explicit.
    expect(rule.assets![0].maxTotal).toBe(maxUint256);
    expect(rule.validUntil).toBe(NO_EXPIRY);
  });

  it('keeps a granted rule\'s exact expiry when its duration is left as loaded', () => {
    const validUntil = Math.floor(Date.now() / 1000) + 10 * 86_400 + 1234;
    const loaded = draft({ rulesId: '0xabc', validUntil, durationDays: '11' });
    expect(toSdkRule(loaded).validUntil).toBe(validUntil);
    // Changing the days recomputes from now.
    const changed = toSdkRule({ ...loaded, durationDays: '5' }).validUntil;
    expect(Math.abs(changed - (Math.floor(Date.now() / 1000) + 5 * 86_400))).toBeLessThan(5);
  });

  it('refuses catalog apps that have no contract configured', () => {
    expect(() => toSdkRule(draft({ apps: [{ appId: 'uniswap', functionIds: ['swapTokens'] }] }))).toThrow(
      AgenticInputError,
    );
  });
});

describe('fromRulesRecord', () => {
  it('reads a granted rule back into the screens', () => {
    const sdkRule = toSdkRule(draft());
    const record: RulesRecord = {
      rulesId: '0xabc',
      enabled: true,
      chainNamespace: sdkRule.chainNamespace!,
      agent: sdkRule.agent,
      validUntil: sdkRule.validUntil,
      // Decoded rules carry the token address and the 4-byte selector, as rules.list() returns them.
      rule: {
        ...sdkRule,
        assets: sdkRule.assets!.map((a) => ({ ...a, token: usdc().address as `0x${string}` })),
        allowedCalls: [{ target: ROUTER, selector: '0xac9650d8', maxValue: 0n }],
      } as Rule,
      spent: { kind: 'universal', assets: [{ token: usdc().address, spent: 0n }] },
    };
    const rule = fromRulesRecord(record)!;
    expect(rule.rulesId).toBe('0xabc');
    expect(rule.networkId).toBe('ethereum');
    expect(rule.tokens[0]).toMatchObject({ totalLimit: '1000', perTxLimit: '100' });
    expect(rule.tokens[0].token?.symbol).toBe('USDC');
    expect(rule.apps[0].customContract).toBe(ROUTER);
    // No registry entry for the selector in a fresh test, so it stays as the 4-byte id.
    expect(rule.apps[0].customFunctions).toEqual(['0xac9650d8']);
    expect(formatExpiresIn(rule)).toBe('30 days');
  });

  it('keeps argument pins through a load and re-grant', () => {
    const sdkRule = toSdkRule(draft());
    const pins = [{ arg: 0, expected: 'agentic:wallet' as const }];
    const record: RulesRecord = {
      rulesId: '0xabc',
      enabled: true,
      chainNamespace: sdkRule.chainNamespace!,
      agent: sdkRule.agent,
      validUntil: sdkRule.validUntil,
      rule: { ...sdkRule, allowedCalls: [{ target: ROUTER, selector: '0xac9650d8', maxValue: 0n, pins }] },
      spent: { kind: 'universal', assets: [] },
    };
    const loaded = fromRulesRecord(record)!;
    expect(toSdkRule(loaded).allowedCalls).toEqual([{ target: ROUTER, selector: '0xac9650d8', pins }]);
  });

  it('skips rule kinds the screens do not support', () => {
    const record = { rulesId: '0x1', enabled: true, chainNamespace: 'eip155:42101', agent: AGENT, validUntil: 0, rule: {} };
    expect(fromRulesRecord(record as unknown as RulesRecord)).toBeNull();
  });
});

describe('fromPresetTemplate', () => {
  it('turns a preset template into a draft the owner completes', () => {
    const template: PresetRuleTemplate = {
      chainNamespace: 'eip155:11155111',
      allowedCalls: [{ target: ROUTER, selector: 'multicall(bytes[])', app: 'Uniswap' }],
      assets: [{ token: usdc().address, maxPerCall: 0n, maxTotal: 0n }],
    };
    const rule = fromPresetTemplate(template, 'draft-p', '30')!;
    expect(rule.networkId).toBe('ethereum');
    expect(rule.agentAddress).toBe('');
    expect(rule.apps[0]).toMatchObject({ customContract: ROUTER, customFunctions: ['multicall(bytes[])'] });
    // Omitted preset caps are zero, which the limit fields reject until the owner sets them.
    expect(rule.tokens[0]).toMatchObject({ totalLimit: '0', perTxLimit: '0' });
    expect(rule.durationDays).toBe('30');
  });

  it('never adds a default token to a preset without assets', () => {
    const rule = fromPresetTemplate(
      { chainNamespace: 'eip155:11155111', allowedCalls: [{ target: ROUTER, selector: 'multicall(bytes[])', label: 'Batch' }] },
      'draft-q',
      '30',
    )!;
    expect(rule.tokens).toEqual([]);
    expect(getRuleFunctionLabels(rule)).toEqual(['Batch (bytes[])']);
  });

  it('builds a rule per supported network from the SDK catalog for an agent', () => {
    const presets = getAgenticPresets();
    expect(presets.length).toBeGreaterThan(0);
    const rules = presets[0].buildRules(AGENT);
    expect(rules.length).toBeGreaterThan(0);
    rules.forEach((rule) => expect(rule.agentAddress).toBe(AGENT));
  });

  it('fills a preset with its default tokens and limits, looked up by address', async () => {
    const dex = getAgenticPresets().find((p) => p.key === 'DEXES')!;
    await dex.resolveTokens();
    const sepolia = dex.buildRules(AGENT).find((rule) => rule.networkId === 'ethereum')!;
    const symbols = sepolia.tokens.map((row) => row.token?.symbol);
    expect(symbols).toEqual(expect.arrayContaining(['WETH', 'USDC']));
    // The default policy's 10 USDC per call / 100 total, read with USDC's 6 decimals
    const usdcRow = sepolia.tokens.find((row) => row.token?.address.toLowerCase() === CIRCLE_USDC_SEPOLIA.toLowerCase())!;
    expect(usdcRow).toMatchObject({ perTxLimit: '10', totalLimit: '100' });

    const rule = toSdkRule(sepolia);
    expect(rule.allowedCalls.length).toBeGreaterThan(0);
    rule.allowedCalls.forEach((call) => expect(call.pins?.length).toBeGreaterThan(1));
  });

  it('sends a DEX preset with the same calls the SDK generates, none twice', async () => {
    const dex = getAgenticPresets().find((p) => p.key === 'DEXES')!;
    await dex.resolveTokens();
    const sepolia = dex.buildRules(AGENT).find((rule) => rule.networkId === 'ethereum')!;
    const ours = toSdkRule(sepolia).allowedCalls;
    const sdk = PushChain.utils.agentic.presets.get('DEXES', { chainNamespace: 'eip155:11155111', agent: AGENT }).rules[0]
      .allowedCalls;
    const key = (c: { target: string; selector: string; pins?: unknown }) =>
      JSON.stringify([c.target.toLowerCase(), c.selector, c.pins], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(ours.map(key).sort()).toEqual(sdk.map(key).sort());
  });

  it("reports a preset rule's SDK readiness issues, naming tokens without a Push route", async () => {
    const dex = getAgenticPresets().find((p) => p.key === 'DEXES')!;
    await dex.resolveTokens();
    const rules = dex.buildRules(AGENT);
    const sepolia = rules.find((rule) => rule.networkId === 'ethereum')!;
    const base = rules.find((rule) => rule.networkId === 'base')!;
    expect(sepolia.preset).toBe('DEXES');
    // Sepolia's WETH and Circle USDC both have Push routes (alpha.6); Base Sepolia's WETH does not.
    expect(presetReadinessIssues(sepolia)).toEqual([]);
    expect(presetReadinessIssues(base)).toEqual([
      "WETH can't be sent from Push to Base yet. Remove it or choose a token with a Push route.",
    ]);
    // Rules not made from a preset have no readiness to wait for
    expect(presetReadinessIssues(draft())).toEqual([]);
  });

  it('leaves a token it cannot look up unselected instead of guessing its decimals', () => {
    const rule = fromPresetTemplate(
      {
        chainNamespace: 'eip155:11155111',
        allowedCalls: [{ target: ROUTER, selector: 'multicall(bytes[])' }],
        assets: [{ token: '0x2222222222222222222222222222222222222222', maxPerCall: 10n, maxTotal: 100n }],
      } as PresetRuleTemplate,
      'draft-x',
      '7',
    )!;
    expect(rule.tokens[0].token).toBeNull();
  });
});

describe('call-only rules', () => {
  it('hides the zero-cap gas entry the SDK adds to a rule without tokens', () => {
    const sdkRule = toSdkRule(draft({ tokens: [] }));
    const record: RulesRecord = {
      rulesId: '0xabc',
      enabled: true,
      chainNamespace: sdkRule.chainNamespace!,
      agent: sdkRule.agent,
      validUntil: sdkRule.validUntil,
      rule: { ...sdkRule, assets: [{ token: '0x0000000000000000000000000000000000000000', maxPerCall: 0n, maxTotal: 0n }] },
      spent: { kind: 'universal', assets: [] },
    };
    expect(fromRulesRecord(record)!.tokens).toEqual([]);
    expect(isRuleStepTwoValid(draft({ tokens: [] }))).toBe(true);
  });
});

describe('app catalog from the SDK', () => {
  it('gives Uniswap, PancakeSwap and Aave their testnet contracts and keeps uncovered apps', () => {
    expect(getApp('uniswap')?.contracts?.ethereum).toBe(UNISWAP_SEPOLIA);
    expect(getApp('pancakeswap')?.contracts?.bnb).toBeDefined();
    expect(getApp('aave')?.contracts?.ethereum).toBeDefined();
    expect(getApp('eigenlayer')?.contracts?.ethereum).toBeDefined();
    // Not in the SDK catalog: still listed, no contract.
    expect(getApp('curve')).toBeDefined();
    expect(getApp('curve')?.contracts?.ethereum).toBeUndefined();
  });

  it('sends catalog functions with the pins the SDK generates for the selected token', () => {
    const aave = getApp('aave')!;
    const supply = aave.functions.find((fn) => fn.label === 'Supply')!;
    // Aave's Sepolia USDC reserve, added as a custom token
    const reserve = { address: AAVE_USDC_SEPOLIA, symbol: 'USDC', decimals: 6 };
    const rule = toSdkRule(
      draft({
        apps: [{ appId: 'aave', functionIds: [supply.id] }],
        tokens: [{ token: reserve, totalLimit: '1,000', perTxLimit: '100' }],
      }),
    );
    expect(rule.allowedCalls).toHaveLength(1);
    expect(rule.allowedCalls[0]).toMatchObject({
      target: aave.contracts!.ethereum,
      selector: 'supply(address,uint256,address,uint16)',
    });
    expect(rule.allowedCalls[0].pins).toEqual(
      expect.arrayContaining([
        { arg: 2, expected: 'agentic:wallet' },
        { arg: 0, expected: AAVE_USDC_SEPOLIA },
        { arg: 1, max: 100_000_000n },
      ]),
    );
  });

  it('rejects a catalog function none of whose tokens is selected', () => {
    const aave = getApp('aave')!;
    const supply = aave.functions.find((fn) => fn.label === 'Supply')!;
    const build = (tokens: AgenticRule['tokens']) =>
      toSdkRule(draft({ apps: [{ appId: 'aave', functionIds: [supply.id] }], tokens }));
    // Push's USDC is not an Aave reserve; no token at all leaves a zero amount cap.
    expect(() => build([{ token: usdc(), totalLimit: '', perTxLimit: '' }])).toThrow(AgenticInputError);
    expect(() => build([])).toThrow(/Supply on Aave/);
  });

  it('reads a granted call to a catalog contract back as that app', () => {
    const sdkRule = toSdkRule(draft());
    const record: RulesRecord = {
      rulesId: '0xabc',
      enabled: true,
      chainNamespace: sdkRule.chainNamespace!,
      agent: sdkRule.agent,
      validUntil: sdkRule.validUntil,
      rule: { ...sdkRule, allowedCalls: [{ target: UNISWAP_SEPOLIA, selector: '0x04e45aaf', maxValue: 0n }] },
      spent: { kind: 'universal', assets: [] },
    };
    expect(fromRulesRecord(record)!.apps[0]).toMatchObject({ appId: 'uniswap' });
  });
});

describe('findAmbiguousRules', () => {
  it('flags two rules for the same agent on one network', () => {
    expect(findAmbiguousRules([draft(), draft({ id: 'draft-2' })])).toMatch(/Rule 1 and Rule 2/);
    expect(findAmbiguousRules([draft(), draft({ id: 'draft-2', networkId: 'base' })])).toBeNull();
  });
});

describe('sortWallets', () => {
  const wallet = (name: string, index: number, pinOrder = -1) => ({
    address: `0x${String(index).padStart(40, '0')}` as `0x${string}`,
    name,
    index,
    pinned: pinOrder >= 0,
    pinOrder,
    rules: [],
    unsupportedRules: 0,
  });

  it('puts pinned wallets on top, most recently pinned first', async () => {
    const { sortWallets } = await import('./agenticWallet.utils');
    const sorted = sortWallets(
      [wallet('A', 0), wallet('B', 1, 0), wallet('C', 2), wallet('D', 3, 1)],
      'recent',
    );
    expect(sorted.map((w) => w.name)).toEqual(['D', 'B', 'C', 'A']);
  });
});

describe('multiple tokens in one rule', () => {
  const weth = () => getNetworkTokens('ethereum').find((t) => t.symbol !== 'USDC')!;

  it('lists the token limits dot-separated, as in the design', () => {
    const tokens = [
      { token: usdc(), totalLimit: '1,000', perTxLimit: '' },
      { token: weth(), totalLimit: '2', perTxLimit: '' },
    ];
    expect(formatTokenLimits(tokens, 'totalLimit')).toBe(`1,000 USDC · 2 ${weth().symbol}`);
    expect(formatTokenLimits(tokens, 'perTxLimit')).toBe(`∞ USDC · ∞ ${weth().symbol}`);
  });

  it('sends each token as its own asset cap', () => {
    const rule = toSdkRule(draft({ tokens: [
      { token: usdc(), totalLimit: '10', perTxLimit: '1' },
      { token: weth(), totalLimit: '', perTxLimit: '' },
    ] }));
    expect(rule.assets).toHaveLength(2);
    expect(rule.assets![1].maxTotal).toBe(maxUint256);
  });

  it('refuses a token picked twice, as the contracts do', () => {
    const tokens = [
      { token: usdc(), totalLimit: '', perTxLimit: '' },
      { token: usdc(), totalLimit: '', perTxLimit: '' },
    ];
    expect(findDuplicateToken(tokens)).toBe('USDC');
    expect(isRuleStepTwoValid(draft({ tokens }))).toBe(false);
  });

  it('refuses more than 8 tokens', () => {
    const tokens = Array.from({ length: 9 }, (_, i) => ({
      token: { address: getAddress(`0x${(i + 1).toString(16).padStart(40, '0')}`), symbol: `T${i}`, decimals: 18 },
      totalLimit: '',
      perTxLimit: '',
    }));
    expect(isRuleStepTwoValid(draft({ tokens }))).toBe(false);
    expect(isRuleStepTwoValid(draft({ tokens: tokens.slice(0, 8) }))).toBe(true);
  });
});

describe('Solana rules', () => {
  const PROGRAM = '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx';
  const sol = () => getNetworkTokens('solana').find((t) => t.symbol === 'SOL')!;
  const solanaDraft = (overrides: Partial<AgenticRule> = {}) =>
    draft({
      networkId: 'solana',
      apps: [{ appId: 'push-test-counter', functionIds: ['receive_sol(u64)', 'increment(u64)'] }],
      tokens: [{ token: sol(), totalLimit: '1', perTxLimit: '0.01' }],
      ...overrides,
    });

  it('sends listed instructions with the wallet account pin and a SOL amount cap', () => {
    const rule = toSdkRule(solanaDraft());
    expect(rule.chainNamespace).toMatch(/^solana:/);
    expect(rule.assets).toEqual([expect.objectContaining({ maxPerCall: 10_000_000n, maxTotal: 1_000_000_000n })]);
    expect(rule.allowedCalls).toEqual([
      {
        target: PROGRAM,
        selector: 'receive_sol(u64)',
        pins: [{ account: 2, expected: 'agentic:wallet' }, { arg: 0, max: 10_000_000n }],
      },
      { target: PROGRAM, selector: 'increment(u64)', pins: [{ account: 1, expected: 'agentic:wallet' }] },
    ]);
  });

  it('allows SPL Memo by its raw PUSHAGW: prefix with the wallet as the signer, and reads it back', () => {
    const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
    const rule = toSdkRule(solanaDraft({ tokens: [], apps: [{ appId: 'spl-memo', functionIds: ['memo:PUSHAGW'] }] }));
    expect(rule.allowedCalls).toEqual([
      { target: MEMO, selector: '0x505553484147573a', pins: [{ account: 0, expected: 'agentic:wallet' }] },
    ]);
    const programHex = `0x${Buffer.from(new PublicKey(MEMO).toBytes()).toString('hex')}` as `0x${string}`;
    const record = {
      rulesId: '0xdef',
      enabled: true,
      chainNamespace: getNetwork('solana').chain,
      agent: AGENT,
      validUntil: NO_EXPIRY,
      rule: {
        format: 'decoded',
        agent: AGENT,
        chainNamespace: getNetwork('solana').chain,
        validUntil: NO_EXPIRY,
        maxGasPerCall: 20000000000000000000n,
        assets: [],
        programs: [{ program: programHex, discriminator: '0x505553484147573a', discriminatorLen: 8, dataless: false, maxAccounts: 255 }],
        pins: [],
        dataPins: [],
      },
      spent: { kind: 'universal', assets: [] },
    } as unknown as RulesRecord;
    expect(fromRulesRecord(record)).toMatchObject({ apps: [{ appId: 'spl-memo', functionIds: ['memo:PUSHAGW'] }], maxGasPerCall: '20' });
  });

  it('needs SOL selected for an instruction that moves SOL', () => {
    expect(() => toSdkRule(solanaDraft({ tokens: [] }))).toThrow(/Send SOL .* needs SOL/);
    expect(() =>
      toSdkRule(solanaDraft({ tokens: [], apps: [{ appId: 'push-test-counter', functionIds: ['increment(u64)'] }] })),
    ).not.toThrow();
  });

  it('refuses custom programs on Solana', () => {
    expect(() =>
      toSdkRule(solanaDraft({ apps: [{ appId: null, functionIds: [], customContract: PROGRAM, customFunctions: ['x(u64)'] }] })),
    ).toThrow(AgenticInputError);
  });

  it('reads a stored Solana rule back by program and discriminator', () => {
    const programHex = `0x${Buffer.from(new PublicKey(PROGRAM).toBytes()).toString('hex')}` as `0x${string}`;
    const discriminator = (name: string) => sha256(toHex(`global:${name}`)).slice(0, 18) as `0x${string}`;
    const record = {
      rulesId: '0xabc',
      enabled: true,
      chainNamespace: getNetwork('solana').chain,
      agent: AGENT,
      validUntil: NO_EXPIRY,
      rule: {
        format: 'decoded',
        agent: AGENT,
        chainNamespace: getNetwork('solana').chain,
        validUntil: NO_EXPIRY,
        maxGasPerCall: 100000000000000000n,
        assets: [{ token: sol().address, maxPerCall: 10_000_000n, maxTotal: 1_000_000_000n }],
        programs: [
          { program: programHex, discriminator: discriminator('receive_sol'), discriminatorLen: 8, dataless: false, maxAccounts: 255 },
        ],
        pins: [],
        dataPins: [],
      },
      spent: { kind: 'universal', assets: [] },
    } as unknown as RulesRecord;
    expect(fromRulesRecord(record)).toMatchObject({
      networkId: 'solana',
      apps: [{ appId: 'push-test-counter', functionIds: ['receive_sol(u64)'] }],
      tokens: [{ token: { symbol: 'SOL' }, perTxLimit: '0.01', totalLimit: '1' }],
      maxGasPerCall: '0.1',
    });

    const stored = record.rule as unknown as { programs: object[] };
    const unknown = { ...record, rule: { ...stored, programs: [{ ...stored.programs[0], discriminator: '0x0102030405060708' }] } };
    expect(fromRulesRecord(unknown as unknown as RulesRecord)).toBeNull();
  });
});

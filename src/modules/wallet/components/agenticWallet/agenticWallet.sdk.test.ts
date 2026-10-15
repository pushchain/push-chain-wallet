import { describe, expect, it } from 'vitest';
import { getAddress, maxUint256 } from 'viem';
import type { PresetRuleTemplate, Rule, RulesRecord } from '@pushchain/core';
import { NO_EXPIRY } from './agenticWallet.constants';
import { AgenticInputError, fromPresetTemplate, fromRulesRecord, getNetworkTokens, toSdkRule } from './agenticWallet.sdk';
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

const AGENT = getAddress('0x9cfa1c55e8b23fb4c2a3e2d55d0b1c7b0ae4ebdc');
const ROUTER = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';

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
    expect(getRuleFunctionLabels(rule)).toEqual(['Batch']);
  });

  it('builds a rule per supported network from the SDK catalog for an agent', () => {
    const presets = getAgenticPresets();
    expect(presets.length).toBeGreaterThan(0);
    const rules = presets[0].buildRules(AGENT);
    expect(rules.length).toBeGreaterThan(0);
    rules.forEach((rule) => {
      expect(rule.agentAddress).toBe(AGENT);
      expect(() => toSdkRule(rule)).not.toThrow();
    });
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

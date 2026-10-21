import { PushChain } from '@pushchain/core';
import type { ForeignChainNamespace } from '@pushchain/core';
import { getAddress } from 'viem';
import { AGENTIC_NETWORKS } from './agenticWallet.constants';
import { defaultToken, fromPresetTemplate, resolveTokens } from './agenticWallet.sdk';
import { AgenticRule } from './agenticWallet.types';
import { getNetwork } from './agenticWallet.utils';

const DEFAULT_NETWORK = 'ethereum';
const DEFAULT_DURATION_DAYS = '30';

let draftCounter = 0;
export const newDraftId = () => `draft-${Date.now()}-${(draftCounter += 1)}`;

export const createEmptyRule = (networkId = DEFAULT_NETWORK): AgenticRule => ({
  id: newDraftId(),
  networkId,
  apps: [{ appId: null, functionIds: [] }],
  tokens: [{ token: defaultToken(networkId), totalLimit: '', perTxLimit: '' }],
  maxGasPerCall: getNetwork(networkId).defaultGasPerCall,
  agentAddress: '',
  durationDays: DEFAULT_DURATION_DAYS,
});

export type AgenticPreset = {
  key: string;
  title: string;
  description: string;
  /* Looks up the preset's default tokens so buildRules can show them by name */
  resolveTokens: () => Promise<void>;
  /* One rule per supported network the preset covers, for the given agent; the owner reviews and can edit each. */
  buildRules: (agent: string) => AgenticRule[];
};

/*
 * Strategy presets shown under "Or choose a preset", from the SDK's reviewed catalog
 * (PushChain.utils.agentic.presets). Categories with no network this wallet supports are
 * hidden, as the SDK asks. Picking one only asks for the agent (Figma "Preset - Delegated
 * Agents Wallet"); the templates then fill a rule per network for the review screen.
 */
export const getAgenticPresets = (): AgenticPreset[] => {
  const { presets } = PushChain.utils.agentic;
  return presets.list().presets.flatMap((preset) => {
    const networks = AGENTIC_NETWORKS.filter((n) => preset.chains.some((c) => c === n.chain));
    if (!networks.length) return [];
    return [
      {
        key: preset.constant,
        title: preset.name,
        description: networks.map((n) => n.name).join(' · '),
        resolveTokens: async () => {
          await Promise.all(
            networks.map((network) => {
              const { rules } = presets.get(preset.constant, { chainNamespace: network.chain as ForeignChainNamespace });
              const addresses = rules.flatMap((rule) =>
                (rule.assets ?? []).map((asset) => (typeof asset.token === 'string' ? asset.token : asset.token.address)),
              );
              return resolveTokens(network.id, addresses);
            }),
          );
        },
        buildRules: (agent: string) =>
          networks.flatMap((network) => {
            const { rules } = presets.get(preset.constant, {
              chainNamespace: network.chain as ForeignChainNamespace,
              agent: getAddress(agent),
            });
            return rules.flatMap((template) => {
              const rule = fromPresetTemplate(template, newDraftId(), DEFAULT_DURATION_DAYS);
              return rule ? [{ ...rule, preset: preset.constant }] : [];
            });
          }),
      },
    ];
  });
};

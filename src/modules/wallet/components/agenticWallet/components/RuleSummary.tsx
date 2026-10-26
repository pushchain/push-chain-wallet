import { FC, useState } from 'react';
import styled from 'styled-components';
import { CaretDown, CaretUp, OptOut, Pencil } from 'blocks';
import { CHAIN_MONOTONE_LOGO } from 'common';
import { AText, Card } from '../AgenticWallet.styles';
import { AgenticRule } from '../agenticWallet.types';
import {
  formatAllowedApps,
  formatExpiresIn,
  formatGas,
  formatTokenLimits,
  getNetwork,
  getRuleFunctionLabels,
  groupRulesByNetwork,
  isRuleAppEmpty,
  maskAddress,
} from '../agenticWallet.utils';
import { allTokenLimits } from '../agenticWallet.sdk';
import { CardLabel, FunctionTags } from './FormControls';

type RuleCardProps = {
  rule: AgenticRule;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

const RuleCard: FC<RuleCardProps> = ({ rule, index, onEdit, onDelete }) => {
  // A draft without tokens grants every token Push can send there, at the SDK's default limits; list them before signing.
  const allTokens = !rule.rulesId && rule.tokens.length === 0 ? allTokenLimits(rule) : null;
  const limits = (key: 'totalLimit' | 'perTxLimit') =>
    allTokens ? `All tokens: ${formatTokenLimits(allTokens, key)}` : formatTokenLimits(rule.tokens, key);
  const hasApps = rule.apps.some((ruleApp) => !isRuleAppEmpty(ruleApp));
  const rows = [
    { label: 'Delegated Agents Wallet', value: maskAddress(rule.agentAddress) || '—' },
    // Without apps, the agent may only send the rule's tokens back to the owner.
    { label: 'Allowed Apps', value: hasApps ? formatAllowedApps(rule) : 'None (send tokens back to owner only)' },
    { label: 'Max total spend', value: limits('totalLimit') },
    { label: 'Max per call', value: limits('perTxLimit') },
    { label: 'Gas limit per call', value: formatGas(rule.maxGasPerCall) },
    { label: 'Expires in', value: formatExpiresIn(rule) },
  ];

  const menuItems = [
    ...(onEdit
      ? [{ key: 'edit', label: 'Edit Rule', icon: <Pencil size={24} />, onSelect: onEdit }]
      : []),
    ...(onDelete
      ? [{ key: 'delete', label: 'Delete Rule', icon: <OptOut size={24} />, onSelect: onDelete }]
      : []),
  ];

  const functionLabels = getRuleFunctionLabels(rule);

  return (
    <Card gap="var(--spacing-xs)">
      <CardLabel label={`Rule ${index + 1}`} menuItems={menuItems} />
      <Rows>
        {rows.map((row) => (
          <Row key={row.label}>
            <AText variant="caption-small-medium" color="var(--aw-text-tertiary-inverse)" nowrap>
              {row.label}
            </AText>
            {/* Several apps or tokens run on as "a · b · c", wrapping right-aligned within ~200px */}
            <Value>
              <AText variant="caption-small-medium" align="right">
                {row.value}
              </AText>
            </Value>
          </Row>
        ))}
        {functionLabels.length > 0 && (
          <FunctionsBlock>
            <FunctionTags labels={functionLabels} gap={4} />
          </FunctionsBlock>
        )}
      </Rows>

    </Card>
  );
};

const Rows = styled.div`
  display: flex;
  flex-direction: column;
`;

/* 24px row; the divider is drawn inside it, as in the design. */
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs);
  min-height: 24px;
  padding: 5px 0;
  box-sizing: border-box;
  box-shadow: inset 0 -1px 0 var(--pw-int-border-tertiary-color);
`;

const Value = styled.div`
  max-width: 200px;
`;

const FunctionsBlock = styled.div`
  padding: var(--spacing-xxs) 0 var(--spacing-xxxs);
`;

/*
 * 20px chain badge. The blocks monotone icons hard-code a light badge (#EAEBF2) and a
 * dark glyph (#202124); the design uses surface/tertiary and icon/primary, so those two
 * fills are remapped to the theme tokens.
 */
export const NetworkBadge: FC<{ chainId: string | number }> = ({ chainId }) => {
  const Logo = CHAIN_MONOTONE_LOGO[chainId];
  return <Badge>{Logo && <Logo size={20} />}</Badge>;
};

const Badge = styled.span`
  display: flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  path[fill='#EAEBF2'] {
    fill: var(--pw-int-bg-tertiary-color);
  }
  path[fill='#202124'] {
    fill: var(--pw-int-icon-primary-color);
  }
  /* Cut-outs inside the glyph (Arbitrum, Solana) follow the badge colour */
  path[fill='white'] {
    fill: var(--pw-int-bg-tertiary-color);
  }
`;

type RulesByNetworkProps = {
  rules: AgenticRule[];
  onEditRule?: (index: number) => void;
  onDeleteRule?: (index: number) => void;
};

/* Rules grouped under collapsible network headers; every group starts expanded. */
export const RulesByNetwork: FC<RulesByNetworkProps> = ({ rules, onEditRule, onDeleteRule }) => {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const groups = groupRulesByNetwork(rules);

  const toggle = (networkId: string) =>
    setCollapsed((prev) => (prev.includes(networkId) ? prev.filter((id) => id !== networkId) : [...prev, networkId]));

  return (
    <Groups>
      {groups.map((group) => {
        const network = getNetwork(group.networkId);
        const isOpen = !collapsed.includes(group.networkId);
        return (
          <Group key={group.networkId}>
            <GroupHeader onClick={() => toggle(group.networkId)} aria-expanded={isOpen}>
              <NetworkBadge chainId={network.chainId} />
              <AText
                variant="body-small-medium"
                color={isOpen ? 'var(--pw-int-text-primary-color)' : 'var(--pw-int-text-secondary-color)'}
              >
                {network.name}
              </AText>
              <CaretSlot>
                {isOpen ? (
                  <CaretUp size={16} color="pw-int-icon-primary-color" />
                ) : (
                  <CaretDown size={16} color="pw-int-icon-primary-color" />
                )}
              </CaretSlot>
            </GroupHeader>
            {isOpen && (
              <Cards>
                {group.rules.map(({ rule, index }) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    index={index}
                    onEdit={onEditRule ? () => onEditRule(index) : undefined}
                    onDelete={onDeleteRule ? () => onDeleteRule(index) : undefined}
                  />
                ))}
              </Cards>
            )}
          </Group>
        );
      })}
    </Groups>
  );
};

const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
`;

const GroupHeader = styled.button`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
  width: 100%;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
`;

const CaretSlot = styled.span`
  display: flex;
  margin-left: auto;
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
`;

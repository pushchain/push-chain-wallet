import { FC, useState } from 'react';
import styled from 'styled-components';
import { Add, Download, ExternalLinkIcon, SendNotification, SwapDashboard, YieldFarming } from 'blocks';
import { FAUCET_URL } from 'common';
import { useWalletOperations } from '../../../../hooks/useWalletOperations';
import { formatTokenValue } from '../../Wallet.utils';
import { AText, Card, ErrorText, PrimaryButton, Screen, ScrollBody, SecondaryButton } from './AgenticWallet.styles';
import { AgenticWallet } from './agenticWallet.types';
import { AgenticHeader } from './components/AgenticHeader';
import { LineTabs } from './components/FormControls';
import { RulesByNetwork } from './components/RuleSummary';

type DetailsTab = 'tokens' | 'rules' | 'activity' | 'subAccounts';

type AgenticWalletDetailsProps = {
  wallet: AgenticWallet;
  onBack: () => void;
  onClose: () => void;
  /* Opens the Receive page for this wallet's address */
  onReceive: () => void;
  onAddRule: () => void;
  onEditRule: (index: number) => void;
  /* Revokes on chain; rejects with a message to show */
  onDeleteRule: (index: number) => Promise<void>;
};

const ACTIONS = [
  { label: 'Receive', Icon: Download },
  { label: 'Send', Icon: SendNotification },
  { label: 'Swap', Icon: SwapDashboard },
];

const AgenticWalletDetails: FC<AgenticWalletDetailsProps> = ({
  wallet,
  onBack,
  onClose,
  onReceive,
  onAddRule,
  onEditRule,
  onDeleteRule,
}) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>('rules');
  const [ruleAction, setRuleAction] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const { data: balance } = useWalletOperations(wallet.address);
  const balanceValue = Number(balance ?? 0);
  const hasFunds = balanceValue > 0;

  const deleteRule = async (index: number) => {
    setRuleAction({ busy: true });
    try {
      await onDeleteRule(index);
      setRuleAction({ busy: false });
    } catch (error) {
      setRuleAction({ busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Screen gap={hasFunds ? "var(--spacing-md)" : "var(--spacing-sm)"}>
      <AgenticHeader
        variant="agenticWallet"
        title={wallet.name}
        address={wallet.address}
        onBack={onBack}
        onClose={onClose}
      />

      <ScrollBody gap="var(--spacing-sm)">
        <TopSection>
          {hasFunds ? (
            <Balance>
              <AText variant="balance" align="center">
                {`${formatTokenValue(balanceValue, balanceValue < 1 ? 6 : 2)} PC`}
              </AText>
              <FaucetLink />
            </Balance>
          ) : (
            <Card emphasis padding="var(--spacing-sm)">
              <FundContent>
                <FundIconBox>
                  <YieldFarming size={24} color="pw-int-icon-brand-color" />
                </FundIconBox>
                <FundText>
                  <TextStack>
                    <AText variant="heading-5" align="center">
                      Fund your agentic wallet
                    </AText>
                    <AText variant="body-xs-regular" color="var(--pw-int-text-secondary-color)" align="center">
                      Get your wallet ready for agents
                    </AText>
                  </TextStack>
                  <PrimaryButton type="button" onClick={onReceive}>
                    Add funds
                  </PrimaryButton>
                </FundText>
                <FaucetLink />
              </FundContent>
            </Card>
          )}

          <Actions>
            {ACTIONS.map(({ label, Icon }) => (
              // Send and Swap from an agentic wallet need the SDK's agenticWallet client mode; not wired yet.
              <ActionButton key={label} type="button" onClick={label === 'Receive' ? onReceive : undefined}>
                <Icon size={24} color="pw-int-icon-brand-color" />
                <AText variant="body-xs-medium" nowrap>
                  {label}
                </AText>
              </ActionButton>
            ))}
          </Actions>
        </TopSection>

        <TabsSection>
          <LineTabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DetailsTab)}
            tabs={[
              { key: 'tokens', label: 'Tokens' },
              { key: 'rules', label: 'Rules' },
              { key: 'activity', label: 'Activity' },
              { key: 'subAccounts', label: 'Sub-Accounts' },
            ]}
          />
          {activeTab === 'tokens' && <EmptyTab text="No tokens in this wallet yet." />}
          {activeTab === 'rules' && (
            <RulesTab>
              <RulesIntro>
                <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)">
                  Allowed apps, functions and limits for your agentic wallet.
                </AText>
                <SecondaryButton size="xs" type="button" onClick={onAddRule}>
                  <Add size={16} />
                  Add rules
                </SecondaryButton>
              </RulesIntro>
              {ruleAction.busy && (
                <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
                  Deleting rule… confirm in your wallet.
                </AText>
              )}
              {ruleAction.error && <ErrorText>{ruleAction.error}</ErrorText>}
              {wallet.unsupportedRules > 0 && (
                <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)">
                  {`${wallet.unsupportedRules} more ${wallet.unsupportedRules === 1 ? 'rule is' : 'rules are'} active on this wallet but can't be shown here yet.`}
                </AText>
              )}
              <RulesByNetwork
                rules={wallet.rules}
                onEditRule={onEditRule}
                onDeleteRule={ruleAction.busy ? undefined : deleteRule}
              />
            </RulesTab>
          )}
          {activeTab === 'activity' && <EmptyTab text="No activity yet." />}
          {activeTab === 'subAccounts' && <EmptyTab text="No sub-accounts yet." />}
        </TabsSection>
      </ScrollBody>
    </Screen>
  );
};

export { AgenticWalletDetails };

const FaucetLink: FC = () => (
  <LinkRow href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
    <AText variant="caption-regular" color="var(--aw-text-brand-medium)">
      Get free PC tokens
    </AText>
    <ExternalLinkIcon size={16} style={{ color: 'var(--aw-text-brand-medium)' }} />
  </LinkRow>
);

const EmptyTab: FC<{ text: string }> = ({ text }) => (
  <EmptyTabBox>
    <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
      {text}
    </AText>
  </EmptyTabBox>
);

const TopSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  flex-shrink: 0;
`;

const Balance = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const LinkRow = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxxs);
  text-decoration: none;
`;

const FundContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
`;

const FundIconBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  box-sizing: border-box;
  border-radius: 12.3px;
  box-shadow: inset 0 0 0 1px var(--pw-int-border-brand-medium);
  background: rgba(213, 72, 236, 0.1);
`;

const FundText = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
`;

const TextStack = styled.div`
  display: flex;
  flex-direction: column;
`;

/* Figma "Base Component/Dashboard Options" */
const Actions = styled.div`
  display: flex;
  gap: var(--spacing-xxs);
`;

const ActionButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxxs);
  flex: 1;
  height: 70px;
  padding: var(--spacing-xs) var(--spacing-xxs);
  border: none;
  border-radius: var(--radius-xs);
  background: var(--pw-int-bg-tertiary-color);
  cursor: pointer;
`;

const TabsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex-shrink: 0;
`;

const RulesTab = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-xs);
`;

const RulesIntro = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);

  > span {
    flex: 1;
  }
`;

const EmptyTabBox = styled.div`
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
`;

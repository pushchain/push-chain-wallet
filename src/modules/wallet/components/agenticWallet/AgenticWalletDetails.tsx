import { FC, useEffect, useState } from 'react';
import { usePushChain } from '../../../../context/PushChainContext';
import type { TokenDetails } from '../../../../context/SendTokenContext';
import { ActiveStates } from '../../../../types';
import { AgenticScope } from './components/AgenticScope';
import { SwapTransactionDrawer } from '../swapComponent/SwapTransactionDrawer';
import { SubAccountsList } from '../SubAccountsList';
import { TokensList } from '../TokensList';
import styled from 'styled-components';
import { Add, Download, ExternalLinkIcon, SendNotification, SwapDashboard, YieldFarming } from 'blocks';
import { FAUCET_URL } from 'common';
import { useWalletOperations } from '../../../../hooks/useWalletOperations';
import { formatTokenValue } from '../../Wallet.utils';
import { AText, Card, PrimaryButton, Screen, ScrollBody, SecondaryButton } from './AgenticWallet.styles';
import { AgenticWallet } from './agenticWallet.types';
import { AgenticHeader } from './components/AgenticHeader';
import { LineTabs } from './components/FormControls';
import { RulesByNetwork } from './components/RuleSummary';
import { DeleteRuleSheet } from './components/CustomSheets';

type DetailsTab = 'tokens' | 'rules' | 'activity' | 'subAccounts';

/* Last tab per wallet, so coming back from Send, Swap or Manage Tokens lands where the user left */
const lastTab = new Map<string, DetailsTab>();

type AgenticWalletDetailsProps = {
  wallet: AgenticWallet;
  onBack: () => void;
  onClose: () => void;
  /* Opens the Receive page for this wallet's address */
  onReceive: () => void;
  /* Send / Swap from this wallet (the normal flows, run as the agentic wallet) */
  onSend: () => void;
  onSwap: () => void;
  /* Navigation requested from inside the tabs' wallet screens, e.g. a token row opening Send */
  onScopeNavigate: (state: ActiveStates, tokenDetails?: TokenDetails) => void;
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
  onSend,
  onSwap,
  onScopeNavigate,
  onAddRule,
  onEditRule,
  onDeleteRule,
}) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>(() => lastTab.get(wallet.address) ?? 'rules');
  useEffect(() => {
    lastTab.set(wallet.address, activeTab);
  }, [wallet.address, activeTab]);
  /* Rule waiting for "Delete Rule" in the confirmation sheet */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const { data: balance } = useWalletOperations(wallet.address);
  const { createAgenticClient } = usePushChain();
  // Start the agentic client as the page opens, so the Tokens and Sub-Accounts tabs are ready.
  useEffect(() => {
    createAgenticClient(wallet.address).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address]);
  const balanceValue = Number(balance ?? 0);
  const hasFunds = balanceValue > 0;

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
              <ActionButton
                key={label}
                type="button"
                onClick={label === 'Receive' ? onReceive : label === 'Send' ? onSend : onSwap}
              >
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
          {activeTab === 'tokens' && (
            <AgenticScope wallet={wallet.address} activeState="walletDashboard" onNavigate={onScopeNavigate}>
              <TokensList agentic setActiveState={(state) => onScopeNavigate(state)} />
            </AgenticScope>
          )}
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
              {wallet.unsupportedRules > 0 && (
                <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)">
                  {`${wallet.unsupportedRules} more ${wallet.unsupportedRules === 1 ? 'rule is' : 'rules are'} active on this wallet but can't be shown here yet.`}
                </AText>
              )}
              {wallet.rules.length === 0 && wallet.unsupportedRules === 0 ? (
                /* Figma "Agentic Wallet Inside (No Rules)" */
                <NoRules>
                  <AText variant="heading-5" align="center">
                    No rules assigned to wallet
                  </AText>
                  <AText variant="body-xs-regular" color="var(--pw-int-text-secondary-color)" align="center">
                    Add rules to your agentic wallet to get started.
                  </AText>
                </NoRules>
              ) : (
                <RulesByNetwork rules={wallet.rules} onEditRule={onEditRule} onDeleteRule={setPendingDelete} />
              )}
            </RulesTab>
          )}
          {activeTab === 'activity' && <EmptyTab text="No activity yet." />}
          {activeTab === 'subAccounts' && (
            <AgenticScope wallet={wallet.address} activeState="walletDashboard" onNavigate={onScopeNavigate}>
              <SubAccountsList />
            </AgenticScope>
          )}
        </TabsSection>
      </ScrollBody>

      {/* Same swap progress drawer as the home dashboard, for swaps made from this wallet */}
      <AgenticScope wallet={wallet.address} activeState="walletDashboard" onNavigate={onScopeNavigate}>
        <SwapTransactionDrawer />
      </AgenticScope>

      {pendingDelete !== null && (
        <DeleteRuleSheet
          ruleNumber={pendingDelete + 1}
          onClose={() => setPendingDelete(null)}
          onDelete={() => onDeleteRule(pendingDelete)}
        />
      )}
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

const NoRules = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
`;

const EmptyTabBox = styled.div`
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
`;

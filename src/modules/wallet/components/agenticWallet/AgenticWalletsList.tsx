import { FC, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Add,
  AgenticWallet as AgenticWalletIcon,
  Back,
  CopyFilled,
  KebabMenuVertical,
  Pencil,
  PinToTop,
  Sort,
  Sparkle,
  Spinner,
  TickCircleFilled,
  YieldFarming,
} from 'blocks';
import { handleCopy } from 'common';
import { AText, Card, ErrorText, IconButton, PrimaryButton, Screen, ScrollBody, SecondaryButton } from './AgenticWallet.styles';
import { AgenticSortOption, AgenticWallet } from './agenticWallet.types';
import { maskAddress, sortWallets } from './agenticWallet.utils';
import { AgenticHeader } from './components/AgenticHeader';
import { AgenticMenu } from './components/AgenticMenu';
import { RenameWalletSheet } from './components/CustomSheets';
import { useAgenticWallets } from './AgenticWalletContext';

type AgenticWalletsListProps = {
  pushWalletAddress: string;
  onBack: () => void;
  onClose: () => void;
  onCreate: () => void;
  onOpenWallet: (walletId: string) => void;
  onFundWallet: (walletId: string) => void;
  onEditRules: (walletId: string) => void;
};

const SORT_OPTIONS: { key: AgenticSortOption; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'alphabetical', label: 'Alphabetical A-Z' },
];

const AgenticWalletsList: FC<AgenticWalletsListProps> = ({
  pushWalletAddress,
  onBack,
  onClose,
  onCreate,
  onOpenWallet,
  onFundWallet,
  onEditRules,
}) => {
  const { wallets, togglePin, renameWallet, loading, error, available, refresh } = useAgenticWallets();
  const [renaming, setRenaming] = useState<AgenticWallet | null>(null);
  const [sort, setSort] = useState<AgenticSortOption>('recent');
  const sortedWallets = useMemo(() => sortWallets(wallets, sort), [wallets, sort]);

  const header = (
    <AgenticHeader
      variant="pushWallet"
      title="Push Wallet"
      address={pushWalletAddress}
      onBack={onBack}
      onClose={onClose}
    />
  );

  // Until the first load settles, show a quiet loading state rather than the empty state.
  if (!wallets.length && (loading || !available || error)) {
    return (
      <Screen>
        {header}
        <StatusBody>
          {error ? (
            <>
              <ErrorText>{error}</ErrorText>
              <SecondaryButton size="xs" type="button" onClick={() => void refresh()}>
                Try again
              </SecondaryButton>
            </>
          ) : (
            <>
              <Spinner size="medium" variant="primary" />
              <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
                Loading your agentic wallets…
              </AText>
            </>
          )}
        </StatusBody>
      </Screen>
    );
  }

  if (!wallets.length) {
    return (
      <Screen>
        {header}
        <ScrollBody>
          <TitleBlock>
            <AText variant="heading-3" align="center">
              Agentic wallets
            </AText>
            <PaddedSubtitle>
              <AText variant="body-small-regular" color="var(--pw-int-text-secondary-color)" align="center">
                Create separate wallets for agents running jobs, with clear rules and functions.
              </AText>
            </PaddedSubtitle>
          </TitleBlock>

          <EmptyBody>
            <Card emphasis padding="var(--spacing-sm)">
              <EmptyCardContent>
                <IconBox>
                  <AgenticWalletIcon size={24} color="pw-int-icon-brand-color" />
                </IconBox>
                <EmptyCardText>
                  <TextStack>
                    <AText variant="heading-5" align="center">
                      No agentic wallets yet
                    </AText>
                    <AText variant="body-xs-regular" color="var(--pw-int-text-secondary-color)" align="center">
                      Create a new wallet to get started.
                    </AText>
                  </TextStack>
                  <PrimaryButton type="button" onClick={onCreate}>
                    Create agentic wallet
                    <Back size={16} style={{ transform: 'rotate(180deg)' }} />
                  </PrimaryButton>
                </EmptyCardText>
              </EmptyCardContent>
            </Card>

            <StepsSection>
              <StepsRow>
                <StepCard number={1} title="Set agent rules" description="Pick trusted apps and spending limits." />
                <StepCard number={2} title="Fund the wallet" description="Add funds after the wallet is created." />
              </StepsRow>
              <Footnote>
                <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
                  Agent fee is only deducted once a job is verified completed.
                </AText>
              </Footnote>
            </StepsSection>
          </EmptyBody>
        </ScrollBody>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <Body>
        <TextStack>
          <AText variant="heading-4">Agentic Wallets</AText>
          <AText variant="body-xs-regular" color="var(--pw-int-text-secondary-color)">
            Create agentic wallets with clear rules and functions.
          </AText>
        </TextStack>

        <ListSection>
          <CountRow>
            <Sparkle size={16} color="pw-int-text-secondary-color" />
            <AText variant="caption-medium" color="var(--pw-int-text-secondary-color)" style={{ flex: 1 }}>
              {`${wallets.length} Agent ${wallets.length === 1 ? 'Wallet' : 'Wallets'}`}
            </AText>
            <AgenticMenu
              items={SORT_OPTIONS.map((option) => ({
                key: option.key,
                label: option.label,
                onSelect: () => setSort(option.key),
              }))}
            >
              {({ isOpen }) => (
                <IconButton aria-label="Sort wallets">
                  <Sort
                    size={24}
                    style={{ color: isOpen ? 'var(--aw-text-brand-medium)' : 'var(--pw-int-text-tertiary-color)' }}
                  />
                </IconButton>
              )}
            </AgenticMenu>
          </CountRow>

          {error && (
            <PartialError>
              <ErrorText>{error}</ErrorText>
              <SecondaryButton size="xs" type="button" onClick={() => void refresh()}>
                Try again
              </SecondaryButton>
            </PartialError>
          )}

          <WalletList>
            {sortedWallets.map((wallet) => (
              <WalletCard
                key={wallet.address}
                wallet={wallet}
                onOpen={() => onOpenWallet(wallet.address)}
                onFund={() => onFundWallet(wallet.address)}
                onEditRules={() => onEditRules(wallet.address)}
                onTogglePin={() => togglePin(wallet.address)}
                onRename={() => setRenaming(wallet)}
              />
            ))}
          </WalletList>
        </ListSection>

        {/* Figma (Wallet Dropdown / Rename Wallet frames): secondary "Add agentic wallet" */}
        <SecondaryButton type="button" onClick={onCreate}>
          <Add size={16} />
          Add agentic wallet
        </SecondaryButton>
      </Body>

      {renaming && (
        <RenameWalletSheet
          currentName={renaming.name}
          onClose={() => setRenaming(null)}
          onRename={(name) => renameWallet(renaming, name)}
        />
      )}
    </Screen>
  );
};

export { AgenticWalletsList };

const StepCard: FC<{ number: number; title: string; description: string }> = ({ number, title, description }) => (
  <StepCardBox>
    <NumberBadge>{number}</NumberBadge>
    <TextStack>
      <AText variant="heading-6" align="center">
        {title}
      </AText>
      <AText variant="caption-small-regular" color="var(--pw-int-text-secondary-color)" align="center">
        {description}
      </AText>
    </TextStack>
  </StepCardBox>
);

type WalletCardProps = {
  wallet: AgenticWallet;
  onOpen: () => void;
  onFund: () => void;
  onEditRules: () => void;
  onTogglePin: () => void;
  onRename: () => void;
};

const WalletCard: FC<WalletCardProps> = ({ wallet, onOpen, onFund, onEditRules, onTogglePin, onRename }) => {
  const [copied, setCopied] = useState(false);

  return (
    <HoverCard strokeInside clickable onClick={onOpen}>
      <WalletRow>
        <AgentIconSlot>
          <AgenticWalletIcon size={22} color="pw-int-icon-brand-color" />
        </AgentIconSlot>
        <WalletMain>
          <WalletText>
            <AText variant="body-small-medium">{wallet.name}</AText>
            <AddressRow>
              <AText variant="body-xs-medium" color="var(--pw-int-text-secondary-color)" nowrap>
                {maskAddress(wallet.address)}
              </AText>
              <CopyButton
                className="copy-icon"
                aria-label="Copy address"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCopy(wallet.address, setCopied);
                }}
              >
                {copied ? (
                  <TickCircleFilled size={12} color="pw-int-icon-success-bold-color" />
                ) : (
                  <CopyFilled size={12} />
                )}
              </CopyButton>
            </AddressRow>
          </WalletText>
          <MenuSlot onClick={(event) => event.stopPropagation()}>
            {/* Figma "Pin to top": a 16px tertiary pin beside the menu on pinned wallets */}
            {wallet.pinned && (
              <PinMark role="img" aria-label="Pinned">
                <PinToTop size={16} style={{ color: 'var(--pw-int-text-tertiary-color)' }} />
              </PinMark>
            )}
            <AgenticMenu
              minWidth="191px"
              sideOffset={2}
              items={[
                {
                  key: 'fund',
                  label: 'Fund Wallet',
                  tone: 'brand',
                  icon: <YieldFarming size={24} />,
                  onSelect: onFund,
                },
                { key: 'edit', label: 'Edit Rules & Limits', icon: <Pencil size={24} />, onSelect: onEditRules },
                { key: 'rename', label: 'Rename Wallet', icon: <AgenticWalletIcon size={24} />, onSelect: onRename },
                {
                  key: 'pin',
                  label: wallet.pinned ? 'Unpin' : 'Pin to top',
                  icon: <PinToTop size={24} />,
                  onSelect: onTogglePin,
                },
              ]}
            >
              {({ isOpen }) => (
                <IconButton aria-label={`${wallet.name} options`}>
                  <KebabMenuVertical
                    size={16}
                    style={{ color: isOpen ? 'var(--aw-text-brand-medium)' : 'var(--pw-int-icon-primary-color)' }}
                  />
                </IconButton>
              )}
            </AgenticMenu>
          </MenuSlot>
        </WalletMain>
      </WalletRow>
    </HoverCard>
  );
};

const PinMark = styled.span`
  display: flex;
  width: 16px;
  height: 16px;
`;

const StatusBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxxs);
  width: 100%;
`;

const PaddedSubtitle = styled.div`
  padding: 0 var(--spacing-md);
`;

const TextStack = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const EmptyBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const EmptyCardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
`;

const EmptyCardText = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
`;

const IconBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12.3px;
  background: rgba(213, 72, 236, 0.1);
`;

const StepsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  height: 209px;
  flex-shrink: 0;
`;

const StepsRow = styled.div`
  display: flex;
  gap: var(--spacing-xs);
`;

const StepCardBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxxs);
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--radius-sm);
  border: 1px solid var(--pw-int-border-secondary-color);
  background: var(--pw-int-bg-primary-color);
`;

const NumberBadge = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xxs);
  background: rgba(213, 72, 236, 0.2);
  color: var(--aw-text-brand-subtle);
  font-family: var(--pw-int-font-family);
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
`;

const Footnote = styled.div`
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-height: 0;
`;

const ListSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  flex: 1;
  min-height: 0;
`;

const CountRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
`;

const WalletList = styled(ScrollBody)`
  gap: var(--spacing-xxs);
`;

const HoverCard = styled(Card)`
  flex-shrink: 0;

  .copy-icon {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  &:hover .copy-icon {
    opacity: 1;
  }
`;

const WalletRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
`;

const AgentIconSlot = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
`;

const WalletMain = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xxxs);
  flex: 1;
  min-width: 0;
`;

const WalletText = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const AddressRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
`;

const MenuSlot = styled.span`
  display: flex;
  gap: var(--spacing-xxxs);
`;

/* Same as the home header's copy icon: 12px, icon-tertiary, brand pink on hover */
const CopyButton = styled(IconButton)`
  width: 16px;
  height: 16px;
  color: var(--pw-int-icon-tertiary-color);

  &:hover {
    color: var(--pw-int-icon-brand-color);
  }
`;

/* Some wallets loaded and some didn't: the rest stay usable, with a retry for the missing ones. */
const PartialError = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs);
`;

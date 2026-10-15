import { FC, ReactNode, useState } from 'react';
import styled from 'styled-components';
import { AgenticWallet as AgenticWalletIcon, Back, CopyFilled, Cross, ExternalLinkIcon, TickCircleFilled } from 'blocks';
import { EXPLORER_URL, handleCopy } from 'common';
import { Jazzicon } from '../../../../../common/components/JazzIcon';
import { AText, IconButton } from '../AgenticWallet.styles';
import { maskAddress } from '../agenticWallet.utils';

type AgenticHeaderProps = {
  address: string;
  /* Push Wallet header shows the account avatar; an agentic wallet shows the agent icon */
  variant: 'pushWallet' | 'agenticWallet';
  title: string;
  onBack: () => void;
  onClose: () => void;
};

/* Figma "Base Component/Account Header Min" */
const AgenticHeader: FC<AgenticHeaderProps> = ({ address, variant, title, onBack, onClose }) => {
  const [copied, setCopied] = useState(false);

  let avatar: ReactNode = (
    <Avatar>
      <Jazzicon address={address} size={28} />
    </Avatar>
  );
  if (variant === 'agenticWallet') {
    avatar = (
      <AgentIconSlot>
        <AgenticWalletIcon size={22} color="pw-int-icon-brand-color" />
      </AgentIconSlot>
    );
  }

  return (
    <Row>
      <BackButton onClick={onBack} aria-label="Back">
        <Back size={24} color="pw-int-text-tertiary-color" />
      </BackButton>

      <Identity>
        {avatar}
        <Details>
          <AText variant="body-xs-medium" nowrap>
            {title}
          </AText>
          <AddressRow>
            <AText variant="caption-small-medium" color="var(--pw-int-text-tertiary-color)" nowrap>
              {maskAddress(address)}
            </AText>
            <CopySlot onClick={() => handleCopy(address, setCopied)} aria-label="Copy address">
              {copied ? (
                <TickCircleFilled size={12} color="pw-int-icon-success-bold-color" />
              ) : (
                <CopyFilled size={12} />
              )}
            </CopySlot>
            <IconSlot
              onClick={() => window.open(`${EXPLORER_URL}/address/${address}`, '_blank')}
              aria-label="View on explorer"
            >
              <ExternalLinkIcon size={16} color="pw-int-text-tertiary-color" />
            </IconSlot>
          </AddressRow>
        </Details>
      </Identity>

      <IconButton onClick={onClose} aria-label="Close">
        <Cross size={24} color="pw-int-icon-primary-color" />
      </IconButton>
    </Row>
  );
};

export { AgenticHeader };

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  width: 100%;
  height: 34px;
  flex-shrink: 0;
`;

const BackButton = styled(IconButton)`
  padding: var(--spacing-xxxs);
  border-radius: var(--radius-sm);
`;

const Identity = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: 1;
  min-width: 0;
`;

const Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-round);
  overflow: hidden;
  flex-shrink: 0;
`;

const AgentIconSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
`;

const Details = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const AddressRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
`;

const IconSlot = styled(IconButton)`
  width: 16px;
  height: 16px;
`;

/* Same as the home header's copy icon: 12px, icon-tertiary, brand pink on hover */
const CopySlot = styled(IconSlot)`
  color: var(--pw-int-icon-tertiary-color);

  &:hover {
    color: var(--pw-int-icon-brand-color);
  }
`;

import { FC, ReactNode, useEffect } from 'react';
import styled from 'styled-components';
import { Cross } from 'blocks';
import { AText, agenticTokens, IconButton } from '../AgenticWallet.styles';

type BottomSheetProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  /* Taller sheets centre their content, as the custom-functions sheet does */
  minHeight?: number;
};

/*
 * Figma "Add a custom contract" / "Add custom functions": a sheet rising from the
 * bottom of the wallet card, full card width, 12px padding and the card's gradient
 * stroke. It positions against the card (the nearest positioned ancestor), and an
 * invisible layer under it keeps the screen behind from being clicked.
 */
const BottomSheet: FC<BottomSheetProps> = ({ title, subtitle, onClose, children, minHeight }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <Blocker />
      <Sheet role="dialog" aria-modal="true" aria-label={title} $minHeight={minHeight}>
        <Header>
          <CloseButton onClick={onClose} aria-label="Close">
            <Cross size={16} color="pw-int-icon-primary-color" />
          </CloseButton>
          <TitleBlock>
            <AText variant="heading-4" align="center">
              {title}
            </AText>
            <Subtitle>
              <AText variant="body-small-regular" color="var(--pw-int-text-tertiary-color)" align="center">
                {subtitle}
              </AText>
            </Subtitle>
          </TitleBlock>
        </Header>
        {children}
      </Sheet>
    </>
  );
};

export { BottomSheet };

const Blocker = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
`;

const Sheet = styled.div<{ $minHeight?: number }>`
  ${agenticTokens}
  ${({ $minHeight }) => ($minHeight ? `min-height: ${$minHeight}px; justify-content: center;` : '')}
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 6;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  /* 12px in the design, where the 1.5px stroke sits inside it */
  padding: 10.5px;
  border-radius: var(--radius-md);
  border: 1.5px solid transparent;
  background:
    linear-gradient(var(--pw-int-bg-secondary-color), var(--pw-int-bg-secondary-color)) padding-box,
    linear-gradient(
        349deg,
        var(--pw-int-border-secondary-color) 0%,
        var(--aw-sheet-glow-pink) 48.6%,
        var(--aw-sheet-glow-blue) 59.9%,
        var(--pw-int-border-secondary-color) 79.6%
      )
      border-box;
  box-sizing: border-box;
`;

const Header = styled.div`
  position: relative;
  padding-top: var(--spacing-xxs);
`;

const CloseButton = styled(IconButton)`
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxxs);
  padding: 0 var(--spacing-xs);
`;

/* Keeps line breaks in the copy, e.g. the two-line delete confirmation */
const Subtitle = styled.div`
  padding: 0 var(--spacing-md);
  white-space: pre-line;
`;

/* Form area and primary action, 48px apart as in the design. */
export const SheetBody = styled.div<{ minFormHeight?: number }>`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxl);

  > :first-child {
    ${({ minFormHeight }) => (minFormHeight ? `min-height: ${minFormHeight}px;` : '')}
  }
`;

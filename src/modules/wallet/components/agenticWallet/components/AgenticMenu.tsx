import { FC, ReactElement, ReactNode } from 'react';
import styled, { css } from 'styled-components';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { Dropdown, DropdownProps, Menu } from 'blocks';
import { agenticTokens } from '../AgenticWallet.styles';

export type AgenticMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  /* "brand" renders the item in the brand colour, as the first action in the wallet menu */
  tone?: 'brand';
  onSelect: () => void;
};

type AgenticMenuProps = {
  items: AgenticMenuItem[];
  children: ReactNode | ((props: { isOpen: boolean }) => ReactElement);
  align?: 'start' | 'center' | 'end';
  minWidth?: string;
  /* Placement relative to the trigger, taken per menu from the design */
  sideOffset?: number;
  alignOffset?: number;
};

/* Figma "List Item" dropdown: surface/secondary, 1px stroke, 12px radius, 8px padding. */
const AgenticMenu: FC<AgenticMenuProps> = ({
  items,
  children,
  align = 'end',
  minWidth = '160px',
  sideOffset = 1,
  alignOffset = 0,
}) => (
  <Dropdown
    side="bottom"
    align={align}
    sideOffset={sideOffset}
    alignOffset={alignOffset}
    css={css`
      z-index: 10;
    `}
    overlay={(setIsOpen) => (
      <StyledMenu minWidth={minWidth}>
        {items.map((item) => (
          <Item
            key={item.key}
            $tone={item.tone}
            onSelect={() => {
              item.onSelect();
              setIsOpen(false);
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </Item>
        ))}
      </StyledMenu>
    )}
  >
    {/* blocks' DropdownProps intersects children with ReactNode, which rejects the render-prop form it supports */}
    {children as DropdownProps['children']}
  </Dropdown>
);

export { AgenticMenu };

const StyledMenu = styled(Menu)`
  ${agenticTokens}
  background-color: var(--pw-int-bg-secondary-color);
  border: none;
  box-shadow: inset 0 0 0 1px var(--pw-int-border-secondary-color);
  border-radius: var(--radius-xs);
  padding: var(--spacing-xxs);
  gap: var(--spacing-xs);
`;

const Item = styled(RadixDropdown.Item)<{ $tone?: 'brand' }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
  padding: var(--spacing-xxxs);
  border-radius: var(--radius-xxs);
  cursor: pointer;
  outline: none;
  font-family: var(--pw-int-font-family);
  font-size: 14px;
  line-height: 20px;
  font-weight: ${({ $tone }) => ($tone === 'brand' ? 500 : 400)};
  color: ${({ $tone }) => ($tone === 'brand' ? 'var(--aw-text-brand-medium)' : 'var(--pw-int-text-primary-color)')};

  [role='img'] {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: ${({ $tone }) => ($tone === 'brand' ? 'var(--aw-text-brand-medium)' : 'var(--pw-int-icon-primary-color)')};
  }

  &:hover,
  &[data-highlighted] {
    background-color: var(--pw-int-bg-tertiary-color);
  }
`;

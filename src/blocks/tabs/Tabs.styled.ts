import { Tabs as ReachTabs, TabList, Tab } from '@reach/tabs';
import { textVariants } from '../text';
import styled from 'styled-components';
import { deviceMediaQ } from '../theme';

export const StyledFillTabs = styled(ReachTabs)`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

export const StyledFillTabList = styled(TabList)`
  overflow: auto hidden;
  display: flex;
  width: fit-content;
  @media${deviceMediaQ.mobileL} {
    width: 100%;
  }
  padding: var(--spacing-xxxs);
  background-color: var(--pw-int-bg-secondary-color);
  border-radius: var(--radius-sm);
  gap: var(--spacing-xxs);
`;

export const StyledFillTab = styled(Tab)`
  display: flex;
  padding: var(--spacing-none) var(--spacing-sm);
  height: 40px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xxs);
  align-self: stretch;
  cursor: pointer;
  color: var(--pw-int-text-secondary-color);
  background-color: transparent;
  border-radius: var(--radius-xs);
  transition: background-color 0.3s, color 0.3s;
  border-bottom: none;

  &[data-selected] {
    background-color: var(--pw-int-bg-secondary-color);
    color: var(--pw-int-text-secondary-color);
  }

  &:focus {
    outline: none;
  }

  &:hover {
    color: var(--pw-int-text-primary-color);
  }

  &:active {
    background-color: transparent;
    color: var(--pw-int-text-primary-color);
  }

  &[aria-disabled='true'] {
    cursor: not-allowed;
    color: var(--pw-int-text-disabled-color);
    opacity: 1;
  }
`;

export const StyledLineTabs = styled(ReachTabs)`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

export const StyledLineTabList = styled(TabList)`
  display: flex;
  background-color: transparent;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-bottom: var(--border-sm) solid var(--pw-int-border-secondary-color);
`;

export const StyledLineTab = styled(Tab)`
  display: flex;
  padding: var(--spacing-none) var(--spacing-sm);
  height: 40px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xxs);
  cursor: pointer;
  margin-bottom: -1px;
  background-color: transparent;
  color: var(--pw-int-text-secondary-color);
  transition: background-color 0.3s, color 0.3s;
  border-bottom: var(--border-md) solid transparent;

  &[data-selected] {
    border-bottom: var(--border-md) solid var(--pw-int-brand-primary-subtle-color);
    color: var(--pw-int-text-primary-color);
  }

  &:hover {
    color: var(--pw-int-text-primary-color);
  }

  &:active {
    background-color: transparent;
    color: var(--pw-int-text-primary-color);
  }

  &[aria-disabled='true'] {
    cursor: not-allowed;
    color: var(--pw-int-text-disabled-color);
    border-bottom: var(--border-md) solid var(--pw-int-text-disabled-color);
    opacity: 1;
  }
`;

export const StyledTabLabel = styled.span`
  white-space: nowrap;
  font-family: var(--pw-int-font-family);
  font-size: ${textVariants['bs-semibold'].fontSize};
  font-style: ${textVariants['bs-semibold'].fontStyle};
  font-weight: ${textVariants['bs-semibold'].fontWeight};
  line-height: ${textVariants['bs-semibold'].lineHeight};
`;

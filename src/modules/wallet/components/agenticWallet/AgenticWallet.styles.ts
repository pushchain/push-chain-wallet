import styled, { css } from 'styled-components';

/*
 * Design tokens from the Agentic Wallet Figma that have no `pw-int-*` equivalent in
 * the blocks theme (or whose value differs from it). Scoped to the agentic screens so
 * the rest of the wallet is untouched; light and dark values come from the Figma
 * "1. Color Semantic" collection.
 */
const lightTokens = css`
  --aw-text-tertiary-inverse: #757d8d;
  --aw-text-brand-medium: #c742dd;
  --aw-text-brand-subtle: #fbe8ff;
  --aw-icon-tertiary: #c4cbd5;
  --aw-stroke-brand-bold: #7b0090;
  --aw-surface-brand-medium: #c742dd;
  --aw-surface-brand-subtle: #fbe8ff;
  --aw-btn-secondary-bg: #f5f6f8;
  --aw-btn-secondary-text: #17181b;
  --aw-btn-disabled-text: #b0b3b9;
  --aw-input-bg: #ffffff;
  --aw-input-placeholder: #b0b3b9;
  --aw-radio-selected: #c742dd;
  --aw-radio-stroke: #c4cbd5;
  --aw-sheet-glow-pink: #f3aeff;
  --aw-sheet-glow-blue: #a2c9ff;
`;

const darkTokens = css`
  --aw-text-tertiary-inverse: #8c93a0;
  --aw-text-brand-medium: #cf59e2;
  --aw-text-brand-subtle: #fbe8ff;
  --aw-icon-tertiary: #8c93a0;
  --aw-stroke-brand-bold: #f3aeff;
  --aw-surface-brand-medium: #d548ec;
  --aw-surface-brand-subtle: #f3aeff;
  --aw-btn-secondary-bg: #313338;
  --aw-btn-secondary-text: #ffffff;
  --aw-btn-disabled-text: #484d58;
  --aw-input-bg: #313338;
  --aw-input-placeholder: #757d8d;
  --aw-radio-selected: #d548ec;
  --aw-radio-stroke: #313338;
  --aw-sheet-glow-pink: #d548ec;
  --aw-sheet-glow-blue: #0056d0;
`;

export const agenticTokens = css`
  ${({ theme }) => ((theme as { scheme?: string })?.scheme === 'dark' ? darkTokens : lightTokens)}
`;

/* Figma text styles, mapped onto the wallet's font family. */
const typography = {
  'heading-3': { size: 26, line: 32, weight: 600 },
  'heading-4': { size: 20, line: 28, weight: 600 },
  'heading-5': { size: 16, line: 23, weight: 600 },
  'heading-6': { size: 14, line: 21, weight: 500 },
  'balance': { size: 34, line: 42, weight: 600 },
  'body-small-medium': { size: 14, line: 20, weight: 500 },
  'body-small-regular': { size: 14, line: 20, weight: 400 },
  'body-xs-medium': { size: 12, line: 18, weight: 500 },
  'body-xs-regular': { size: 12, line: 18, weight: 400 },
  'caption-regular': { size: 12, line: 16, weight: 400 },
  'caption-medium': { size: 12, line: 16, weight: 500 },
  'caption-small-medium': { size: 10, line: 14, weight: 500 },
  'caption-small-regular': { size: 10, line: 14, weight: 400 },
  'overline-large-bold': { size: 12, line: 16, weight: 700 },
  'overline-small-bold': { size: 10, line: 14, weight: 700 },
  'tag': { size: 8, line: 14, weight: 500 },
  'button-medium': { size: 16, line: 16, weight: 500 },
  'button-small': { size: 14, line: 16, weight: 500 },
} as const;

export type AgenticTextVariant = keyof typeof typography;

export const AText = styled.span<{
  variant: AgenticTextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  nowrap?: boolean;
}>`
  display: block;
  font-family: var(--pw-int-font-family);
  font-size: ${({ variant }) => typography[variant].size}px;
  line-height: ${({ variant }) => typography[variant].line}px;
  font-weight: ${({ variant }) => typography[variant].weight};
  color: ${({ color }) => color ?? 'var(--pw-int-text-primary-color)'};
  text-align: ${({ align }) => align ?? 'left'};
  ${({ uppercase }) => uppercase && 'text-transform: uppercase;'}
  ${({ nowrap }) => nowrap && 'white-space: nowrap;'}
  margin: 0;
`;

/* Fixed-height screen inside the 376px wallet card (650 - 2 × 24px padding). */
export const Screen = styled.div<{ gap?: string }>`
  ${agenticTokens}
  display: flex;
  flex-direction: column;
  gap: ${({ gap }) => gap ?? 'var(--spacing-md)'};
  height: 602px;
  width: 100%;
  min-height: 0;

  /* The wallet card goes full-width below mobileL; keep at least the home card's height there */
  @media (max-width: 425px) {
    height: 100%;
    min-height: 602px;
  }
`;

/*
 * Scrollable body. It reaches 11px into the card's right padding so the 2px
 * scrollbar sits where the Figma scroll indicator is, leaving the content 328px wide.
 */
export const ScrollBody = styled.div<{ gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${({ gap }) => gap ?? 'var(--spacing-md)'};
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  margin-right: -11px;
  padding-right: 9px;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 2px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--pw-int-bg-tertiary-color);
    border-radius: var(--radius-round);
  }
  /* Chrome drops the ::-webkit-scrollbar width above when these are set, so only use them elsewhere */
  @supports not selector(::-webkit-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: var(--pw-int-bg-tertiary-color) transparent;
  }
`;

export const Spacer = styled.div`
  flex: 1;
`;

/* Bottom action area: stays put while the body above it scrolls. */
export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex-shrink: 0;
`;

export const ErrorText = styled.span`
  display: block;
  font-family: var(--pw-int-font-family);
  font-size: 12px;
  line-height: 16px;
  color: var(--pw-int-text-danger-bold-color);
  text-align: center;
  word-break: break-word;
`;

/*
 * Figma cards come in two flavours: most count their 1px stroke in the layout (a CSS
 * border), while the strategy and wallet-list cards draw it inside the padding box
 * (`strokeInside`, an inset shadow).
 */
export const Card = styled.div<{
  emphasis?: boolean;
  padding?: string;
  gap?: string;
  clickable?: boolean;
  strokeInside?: boolean;
}>`
  --aw-card-stroke: ${({ emphasis }) =>
    emphasis ? 'var(--pw-int-border-tertiary-color)' : 'var(--pw-int-border-secondary-color)'};
  display: flex;
  flex-direction: column;
  gap: ${({ gap }) => gap ?? 'var(--spacing-xs)'};
  padding: ${({ padding }) => padding ?? 'var(--spacing-xs)'};
  border-radius: var(--radius-sm);
  ${({ strokeInside }) =>
    strokeInside
      ? css`
          box-shadow: inset 0 0 0 1px var(--aw-card-stroke);
        `
      : css`
          border: 1px solid var(--aw-card-stroke);
        `}
  background: ${({ emphasis }) => (emphasis ? 'var(--pw-int-bg-tertiary-color)' : 'var(--pw-int-bg-secondary-color)')};
  width: 100%;
  box-sizing: border-box;
  ${({ clickable }) =>
    clickable &&
    css`
      cursor: pointer;
      transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      &:hover {
        --aw-card-stroke: var(--pw-int-border-tertiary-color);
        background: var(--pw-int-bg-tertiary-color);
      }
    `}
`;

export const PrimaryButton = styled.button<{ $height?: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxxs);
  width: 100%;
  height: ${({ $height }) => $height ?? 48}px;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-xs);
  background: var(--pw-int-btn-primary-bg-color);
  color: var(--pw-int-btn-primary-text-color);
  font-family: var(--pw-int-font-family);
  font-size: 16px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--pw-int-btn-primary-bg-color), #ffffff 10%);
  }
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--pw-int-btn-primary-bg-color), #000000 10%);
  }
  &:disabled {
    background: var(--pw-int-bg-tertiary-color);
    color: var(--aw-btn-disabled-text);
    cursor: not-allowed;
  }
`;

export const SecondaryButton = styled.button<{ size?: 'xs' | 'sm' | 'md' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxxs);
  border: none;
  background: var(--aw-btn-secondary-bg);
  color: var(--aw-btn-secondary-text);
  font-family: var(--pw-int-font-family);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  ${({ size }) =>
    size === 'xs'
      ? css`
          height: 32px;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-xxs);
          font-size: 12px;
          line-height: 16px;
        `
      : size === 'sm'
        ? css`
            width: 100%;
            height: 48px;
            padding: var(--spacing-xs) var(--spacing-md);
            border-radius: var(--radius-xs);
            font-size: 14px;
            line-height: 16px;
          `
        : css`
            width: 100%;
            height: 48px;
            padding: var(--spacing-sm) var(--spacing-md);
            border-radius: var(--radius-xs);
            font-size: 16px;
            line-height: 16px;
          `}

  &:hover {
    background: color-mix(in srgb, var(--aw-btn-secondary-bg), #ffffff 6%);
  }
`;

export const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
`;

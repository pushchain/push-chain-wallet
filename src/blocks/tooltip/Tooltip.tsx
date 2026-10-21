import { type FC, useRef, useState } from 'react';
import styled from 'styled-components';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { TooltipProps } from './Tooltip.types';
import { getTooltipPositionalCSS } from './Tooltip.utils';
import { tooltipCSSPropsKeys } from './Tooltip.constants';
import { useIsVisible } from '../../common';

const RadixTooltipContent = styled(RadixTooltip.Content).withConfig({
  shouldForwardProp: (prop) => !tooltipCSSPropsKeys.includes(prop as keyof TooltipProps),
})<TooltipProps>`
  /* Tooltip default styles */
  display: flex;
  flex-direction: column;
  /* The wallet's spacing and radius tokens (the --s* / --r* scale is not defined here) */
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border-radius: var(--radius-xxs);
  z-index: 1000;
  font-family: var(--pw-int-font-family);
  word-wrap: break-word;
  /* Tertiary surface with a tertiary stroke, so it stands out on the wallet's white cards in either theme */
  color: var(--pw-int-text-secondary-color);
  background-color: var(--pw-int-bg-tertiary-color);
  border: 1px solid var(--pw-int-border-tertiary-color);

  /* Tooltip non-responsive styles */
  width: ${({ width }) => width};
  min-width: ${({ minWidth }) => minWidth};
  max-width: ${({ maxWidth }) => maxWidth};
  height: ${({ height }) => height};
  min-height: ${({ minHeight }) => minHeight};
  max-height: ${({ maxHeight }) => maxHeight};

  ${(props) => props.css || ''};
`;

/*
 * Type from Figma "Base Component/Tooltip" (Push Design Foundations 636:11158): title in
 * Caption Small/Semibold (10/14), description in Caption/Regular (12/16). Fixed sizes, so
 * the wallet's scaled body text sizes don't enlarge them. Colours are the wallet's
 * secondary/tertiary text on a tertiary surface rather than the design's black.
 */
const StyledTitle = styled.span`
  color: var(--pw-int-text-secondary-color);
  font-family: var(--pw-int-font-family);
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
`;

const StyledDescription = styled.span`
  color: var(--pw-int-text-tertiary-color);
  font-family: var(--pw-int-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
`;

const Tooltip: FC<TooltipProps> = ({
  width = 'max-content',
  maxWidth = '274px',
  trigger = 'hover',
  tooltipPosition = 'top-right',
  children,
  description,
  title,
  overlay,
  ...props
}) => {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showTooltip = () => setVisible(true);
  const hideTooltip = () => setVisible(false);

  const onVisibilityChange = (isVisible: boolean) => {
    if (!isVisible) hideTooltip();
  };

  const isInView = useIsVisible(triggerRef, onVisibilityChange);

  const { style, ...cssProps } = getTooltipPositionalCSS(tooltipPosition);
  const triggerArray = typeof trigger === 'string' ? [trigger] : trigger;

  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root
        delayDuration={250}
        open={visible && isInView}
      >
        <RadixTooltip.Trigger
          asChild
          ref={triggerRef}
          onMouseEnter={() => triggerArray.includes('hover') && showTooltip()}
          onMouseLeave={() => triggerArray.includes('hover') && hideTooltip()}
          onClick={showTooltip}
          onFocus={showTooltip}
          onBlur={hideTooltip}
          /* Makes the element focusable to support focus related functions on mobile devices */
          tabIndex={0}
        >
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltipContent
            sideOffset={8}
            {...{ style, width, maxWidth }}
            {...cssProps}
            {...props}
          >
            {overlay ? (
              overlay
            ) : (
              <>
                {title && <StyledTitle>{title}</StyledTitle>}
                {description && <StyledDescription>{description}</StyledDescription>}
              </>
            )}
          </RadixTooltipContent>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip };

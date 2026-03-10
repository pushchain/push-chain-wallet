import { FC, ReactNode } from "react";
import { Box, Cross } from "../../blocks";
import React from "react";
import { css } from "styled-components";
import { useDarkMode } from "../hooks";
import { isUIKitVersion, WALLET_TO_APP_ACTION } from "common";
import { usePushChain } from "../../hooks/usePushChain";

type BoxLayoutProps = {
  children: ReactNode;
};

const BoxLayout: FC<BoxLayoutProps> = ({ children }) => {
  const { isDarkMode } = useDarkMode();
  const { executorAddress } = usePushChain();

  const showCloseButton = isUIKitVersion('1');

  const handleClose = () => {
    window.parent.postMessage(
      { type: WALLET_TO_APP_ACTION.CLOSE_IFRAME },
      '*'
    );
  };

  return (
    <Box
      position="relative"
      width={{ initial: "auto", ml: "90%" }}
      css={css`
        padding: var(--pw-int-modal-border);
        overflow: hidden;
        border-radius: var(--pw-int-modal-border-radius);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        &::before {
          content: "";
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          z-index: 0;
          background: linear-gradient(
            160deg,
            ${isDarkMode ? 'rgb(49, 51, 56)' : 'rgb(240, 240, 240)'} 0px,
            ${isDarkMode ? 'rgb(49, 51, 56)' : 'rgb(240, 240, 240)'} 25%,
            ${isDarkMode ? 'rgba(213, 72, 236, 0.8)' : 'rgba(243, 174, 255, 1)'},
            ${isDarkMode ? 'rgba(0, 86, 208, 0.8)' : 'rgba(162, 201, 255, 1)'},
            ${isDarkMode ? 'rgb(49, 51, 56)' : 'rgb(240, 240, 240)'} 55%,
            ${isDarkMode ? 'rgb(49, 51, 56)' : 'rgb(240, 240, 240)'} 100%
          );
          animation: anim_rotate 14s linear infinite;
          border-radius: inherit;
        }

        &::after {
          content: "";
          position: absolute;
          inset: 1.5px;
          background: ${isDarkMode ? 'rgb(49, 51, 56)' : 'rgb(255, 255, 255)'};
          border-radius: inherit;
          z-index: 1;
        }

        > * {
          position: relative;
          z-index: 2;
        }

        @keyframes anim_rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}
    >
      <Box
        backgroundColor="pw-int-bg-secondary-color"
        borderRadius="radius-md"
        css={css`
          overflow: auto;
          max-height: 100vh;
          width: 100%;
        `}
      >
        {showCloseButton && (
          <Box
            display={{initial: 'block', mm: executorAddress ? 'none' : 'block'}}
            position="absolute"
            cursor="pointer"
            css={css`
              top: var(--spacing-md);
              right: var(--spacing-md);
              z-index: 99;
            `}
            onClick={handleClose}
          >
            <Cross size={24} color='pw-int-icon-primary-color' />
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
};

export { BoxLayout };

import { FC, useEffect, useRef, useState } from "react";
import {
  AgenticWallet,
  Box,
  Download,
  ExternalLinkIcon,
  SendNotification,
  Spinner,
  SwapDashboard,
  Text,
} from "../../../../blocks";
import WalletHeader from "./WalletHeader";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { useWalletOperations } from "../../../../hooks/useWalletOperations";
import { FAUCET_URL, getAppParamValue, isUIKitVersion } from "common";
import { formatTokenValue } from "../../Wallet.utils";
import { css, useTheme } from "styled-components";
import { trackWalletEvent, WALLET_EVENTS } from "../../../../analytics/walletEvents";

export type WalletProfileProps = {
  walletAddress: string;
};

const buttonConfigs = [
  {
    icon: Download,
    label: "Receive",
  },
  {
    icon: SendNotification,
    label: "Send",
  },
  {
    icon: SwapDashboard,
    label: "Swap",
  },
  {
    icon: AgenticWallet,
    label: "Agentic Wallets",
  },
];

const WalletProfile: FC<WalletProfileProps> = ({ walletAddress }) => {
  const { setActiveState, startSendFlow } = useWalletDashboard();
  const isDarkTheme = (useTheme() as { scheme?: string })?.scheme === 'dark';
  const [ fontSize, setFontSize ] = useState(34);
  const isOpenedInIframe = !!getAppParamValue();
  const showSwap = isUIKitVersion('8') || !isOpenedInIframe;

  const ref = useRef<HTMLDivElement>(null);

  const {
    data: balance,
    isLoading: isBalanceLoading,
  } = useWalletOperations(walletAddress);

  const handleFaucetClick = () => {
    trackWalletEvent(WALLET_EVENTS.FAUCET_CLICKED, {
      walletAddress,
      sourceScreen: 'wallet_dashboard',
      step: 'faucet_entry',
    });
    window.open(FAUCET_URL, '_blank');
  };

  const handleAction = (label: string) => {
    if (label === 'Receive') {
      trackWalletEvent(WALLET_EVENTS.RECEIVE_CLICKED, {
        walletAddress,
        sourceScreen: 'wallet_dashboard',
        step: 'receive_entry',
      });
      setActiveState('receive');
      return;
    } else if (label === 'Agentic Wallets') {
      setActiveState('agenticWallets');
      return;
    } else if (label === 'Swap') {
      trackWalletEvent(WALLET_EVENTS.SWAP_CLICKED, {
        walletAddress,
        sourceScreen: 'wallet_dashboard',
        step: 'swap_entry',
      });
      setActiveState('swap');
      return;
    }

    // Send is tracked by startSendFlow so token-card entry points use the same
    // event and cannot double-count this button.
    startSendFlow();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const BASE = 34;
    const MIN = 12;

    const fit = () => {
      let size = BASE;
      el.style.fontSize = `${size}px`;

      while (
        (el.scrollWidth > el.clientWidth && size > MIN)
      ) {
        size -= 2;
        el.style.fontSize = `${size}px`;
      }

      setFontSize(size);
    };

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(fit);
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);

  }, [balance, walletAddress]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="spacing-md"
      width="100%"
    >
      <WalletHeader walletAddress={walletAddress} />

      <Box
        position="relative"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Box
          display="flex"
          alignItems='center'
          justifyContent='center'
          width="100%"
        >
          {isBalanceLoading ? (
            <Spinner size="extraLarge" variant="primary" />
          ) : (
            <Text
              ref={ref}
              color="pw-int-text-primary-color"
              textAlign="center"
              css={css`
                width: 100%;
                font-size: ${fontSize}px;
                overflow: hidden;
                white-space: nowrap;
                font-weight: 500;
                line-height: 42px;
              `}
            >
              {formatTokenValue((Number(balance ?? 0)), (Number(balance ?? 0) < 1 ? 6 : 2))} PC
            </Text>
          )}
        </Box>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="spacing-xxxs"
          cursor="pointer"
          onClick={handleFaucetClick}
        >
          <Text variant="c-regular" color="pw-int-text-link-color">
            Get free PC tokens
          </Text>
          <ExternalLinkIcon size={16} color="pw-int-text-link-color" />
        </Box>
      </Box>
      <Box display="flex" flexDirection="row" justifyContent="space-between" gap='spacing-xxs'>
        {buttonConfigs
          .filter(({ label }) => label !== 'Swap' || showSwap)
          .map(({ icon: Icon, label }) => {
            const isAgentic = label === 'Agentic Wallets';
            return (
              <Box
                key={label}
                display="flex"
                flexDirection="column"
                height="70px"
                padding="spacing-xs spacing-xxs"
                justifyContent="center"
                alignItems="center"
                gap="spacing-xxxs"
                borderRadius="radius-xs"
                cursor="pointer"
                backgroundColor="pw-int-bg-tertiary-color"
                onClick={() => handleAction(label)}
                css={isAgentic ? getAgenticButtonCss(isDarkTheme) : css`flex: 1 0 0;`}
              >
                <Icon color={isAgentic ? undefined : "pw-int-icon-brand-color"} size={24} />
                <Text
                  variant="bes-semibold"
                  css={isAgentic ? css`color: #ffffff; white-space: nowrap;` : css`white-space: nowrap;`}
                >
                  {label}
                </Text>
              </Box>
            );
          })}
      </Box>
    </Box>
  );
};

export { WalletProfile };

/*
 * Figma "Dashboard Options": the Agentic Wallets entry is a brand gradient with a
 * brand-bold stroke. These surface/brand and stroke/brand-bold tokens are not in the
 * blocks theme yet, so their light/dark values are taken from the Figma variables.
 */
const getAgenticButtonCss = (isDark: boolean) => css`
  flex: 0 0 auto;
  border: 1px solid ${isDark ? '#f3aeff' : '#7b0090'};
  background-image: ${isDark
    ? 'linear-gradient(121.22deg, #d548ec 46.053%, #f3aeff 109.78%)'
    : 'linear-gradient(121.22deg, #c742dd 46.053%, #fbe8ff 109.78%)'};
  color: #ffffff;
`;

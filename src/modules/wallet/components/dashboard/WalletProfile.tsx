import { FC, useEffect, useRef, useState } from "react";
import {
  Box,
  Download,
  IconLeading,
  SendNotification,
  Spinner,
  Text,
} from "../../../../blocks";
import WalletHeader from "./WalletHeader";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { useWalletOperations } from "../../../../hooks/useWalletOperations";
import { FAUCET_URL } from "common";
import { formatTokenValue } from "../../Wallet.utils";
import { css } from "styled-components";

export type WalletProfileProps = {
  walletAddress: string;
};

const buttonConfigs = [
  {
    icon: Download,
    label: "Receive",
    onClick: (setActiveState: (state: string) => void, startSendFlow: () => void) =>
      setActiveState("receive"),
  },
  {
    icon: SendNotification,
    label: "Send",
    onClick: (_setActiveState: (state: string) => void, startSendFlow: () => void) =>
      startSendFlow(),
  },
  {
    icon: IconLeading,
    label: "Faucet",
    onClick: () => window.open(FAUCET_URL, "_blank"),
  },
];

const WalletProfile: FC<WalletProfileProps> = ({ walletAddress }) => {
  const { setActiveState, startSendFlow } = useWalletDashboard();
  const [ fontSize, setFontSize ] = useState(34);

  const ref = useRef<HTMLDivElement>(null);

  const {
    data: balance,
    isLoading: isBalanceLoading,
  } = useWalletOperations(walletAddress);

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
          margin="spacing-none spacing-none spacing-xxxs spacing-none"
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
                line-height: 48px;
              `}
            >
              {formatTokenValue((Number(balance ?? 0)), (Number(balance ?? 0) < 1 ? 6 : 2))} PC
            </Text>
          )}
        </Box>
      </Box>
      <Box display="flex" flexDirection="row" justifyContent="space-between" gap='spacing-xxs'>
        {buttonConfigs.map(({ icon: Icon, label, onClick }) => (
          <Box
            key={label}
            display="flex"
            width='100%'
            flexDirection="column"
            padding="spacing-xs"
            justifyContent="center"
            alignItems="center"
            gap="spacing-xxs"
            alignSelf="stretch"
            borderRadius="radius-xs"
            border="border-sm solid pw-int-border-primary-color"
            cursor="pointer"
            backgroundColor="pw-int-bg-primary-color"
            onClick={() => onClick(setActiveState, startSendFlow)}
          >
            <Icon color="pw-int-icon-brand-color" size={24} />
            <Text variant="bes-semibold">{label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export { WalletProfile };

import { Box, Button, Cross, ExternalLink, Text, TickCircleFilled } from "blocks";
import React from "react";
import { css } from "styled-components";
import { centerMaskWalletAddress, EXPLORER_URL } from "common";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { useSendTokenContext } from "../../../../context/SendTokenContext";
import WalletHeader from "../dashboard/WalletHeader";
import { trackWalletEvent, WALLET_EVENTS } from "../../../../analytics/walletEvents";

const Confirmation = () => {
  const { walletAddress, tokenDetails, receiverAddress, amount, txhash, setTxhash, selectedDestinationNetwork, trackingMetadata } =
    useSendTokenContext();
  const { setActiveState } =
    useWalletDashboard();

  // Get current date and time formatted as 'May 27, 2025 — 2:28 PM'
  const now = new Date();
  const datePart = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const formattedDateTime = `${datePart} — ${timePart}`;

  const handleBackToHome = () => {
    setTxhash(null);
    setActiveState("walletDashboard");
  };

  const handleExplorerButton = () => {
    trackWalletEvent(WALLET_EVENTS.SEND_VIEW_TRANSACTION_CLICKED, {
      ...trackingMetadata,
      step: 'view_transaction',
    });
    window.open(`${EXPLORER_URL}/tx/${txhash}`, "_blank");
  };

  return (
    <>
      <WalletHeader walletAddress={walletAddress} />

      <Box
        display="flex"
        flexDirection="column"
        css={css`
          flex: 1;
        `}
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          gap="spacing-md"
        >
          <Text
            variant="h3-semibold"
            color="pw-int-text-primary-color"
            textAlign="center"
          >
            {" "}
            Sent{" "}
          </Text>
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            width="100%"
          >
            <Box
              display="flex"
              gap="spacing-xxs"
              alignSelf="stretch"
              justifyContent="center"
            >
              {txhash ? <TickCircleFilled
                size={48}
                color="pw-int-success-primary-color"
              /> : <Cross
                size={48}
                color="pw-int-icon-danger-bold-color"
              />}
              <Text variant="h2-semibold" color="pw-int-text-primary-color">
                {Number(amount) || amount} {tokenDetails.token?.symbol || ''}
              </Text>
            </Box>
            {/* <Text color="pw-int-text-secondary-color" variant="bs-regular">
              $12.45
            </Text> */}
          </Box>

          <Box display="flex" flexDirection="column" width="100%">
            <Box
              display="flex"
              justifyContent="space-between"
              padding="spacing-sm"
              alignItems="center"
              alignSelf="stretch"
              css={css`
                border-bottom: 1px solid
                  var(--pw-int-border-secondary-color, #313338);
              `}
            >
              <Text color="pw-int-text-tertiary-color" variant="bs-regular">
                Status
              </Text>
              <Text variant="bs-regular">{txhash ? 'Success' : 'Failed'}</Text>
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              padding="spacing-sm"
              alignItems="center"
              alignSelf="stretch"
              css={css`
                border-bottom: 1px solid
                  var(--pw-int-border-secondary-color, #313338);
              `}
            >
              <Text color="pw-int-text-tertiary-color" variant="bs-regular">
                Date
              </Text>
              <Text variant="bs-regular">{formattedDateTime}</Text>
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              padding="spacing-sm"
              alignItems="center"
              alignSelf="stretch"
              css={css`
                border-bottom: 1px solid
                  var(--pw-int-border-secondary-color, #313338);
              `}
            >
              <Text color="pw-int-text-tertiary-color" variant="bs-regular">
                Network
              </Text>
              <Text variant="bs-regular">{selectedDestinationNetwork.label}</Text>
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              padding="spacing-sm"
              alignItems="center"
              alignSelf="stretch"
              css={css`
                border-bottom: 1px solid
                  var(--pw-int-border-secondary-color, #313338);
              `}
            >
              <Text color="pw-int-text-tertiary-color" variant="bs-regular">
                To
              </Text>
              <Text variant="bs-regular">
                {centerMaskWalletAddress(receiverAddress, 5)}
              </Text>
            </Box>
          </Box>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="end"
          css={css`
            flex: 1;
          `}
          gap="spacing-xs"
          alignItems="center"
        >
          <Box
            cursor="pointer"
            display="flex"
            gap="spacing-xxxs"
            onClick={handleExplorerButton}
          >
            <ExternalLink color="pw-int-icon-brand-color" />
            <Text color="pw-int-text-link-color">View on Explorer</Text>
          </Box>
          <Button onClick={handleBackToHome} block>
            Back to Home
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default Confirmation;

import React from "react";
import { Box, Button, SendNotification, Text, WarningCircleFilled } from "blocks";
import { centerMaskWalletAddress, truncateWords } from "common";
import { css } from "styled-components";
import { useSendTokenContext } from "../../../../context/SendTokenContext";
import WalletHeader from "../dashboard/WalletHeader";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { fetchGasPriceInGwei } from '../../../../utils/viemClient';

const Review = () => {
  const {
    walletAddress,
    tokenDetails,
    receiverAddress,
    amount,
    handleSendTransaction,
    sendingTransaction,
    setSendState,
    txError,
    nativeToken
  } = useSendTokenContext();

  const { selectedNetwork } = useWalletDashboard();
  const [networkFee, setNetworkFee] = React.useState<string | null>(null);
  const [feeLoading, setFeeLoading] = React.useState<boolean>(true);
  const [feeError, setFeeError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setFeeLoading(true);
    fetchGasPriceInGwei()
      .then((fee) => {
        if (mounted) {
          setNetworkFee(fee);
          setFeeLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setFeeError('Failed to fetch network fee');
          setFeeLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <WalletHeader
        walletAddress={walletAddress}
        handleBackButton={() => setSendState("selectRecipient")}
      />

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

          {txError && <Box
            display='flex'
            backgroundColor="pw-int-bg-danger-bold"
            alignItems='center'
            padding="spacing-xs"
            borderRadius="radius-sm"
            gap="spacing-xxs"
          >
            <WarningCircleFilled color="pw-int-icon-danger-subtle-color" size={20} />
            <Text wrap variant="h5-semibold" color="pw-int-text-danger-subtle-color">
              {truncateWords(txError, 6)}
            </Text>
          </Box>}

          <Text
            variant="h3-semibold"
            color="pw-int-text-primary-color"
            textAlign="center"
          >
            {" "}
            Review{" "}
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
              <SendNotification size={48} color="pw-int-icon-brand-color" />
              <Text variant="h2-semibold" color="pw-int-text-primary-color">
                {Number(amount) || amount} {tokenDetails.token?.symbol || nativeToken?.symbol || ''}
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
                Send To
              </Text>
              <Text variant="bs-regular">
                {centerMaskWalletAddress(receiverAddress, 5)}
              </Text>
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
              <Text variant="bs-regular">{selectedNetwork}</Text>
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
                Network Fee
              </Text>
              <Text variant="bs-regular">
                {feeLoading ? 'Loading...' : feeError ? feeError : `${networkFee} uPC`}
              </Text>
            </Box>
          </Box>
        </Box>
        <Box
          display="flex"
          alignItems="end"
          css={css`
            flex: 1;
          `}
        >
          <Button
            onClick={handleSendTransaction}
            block
            loading={sendingTransaction}
          >
            Confirm send
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default Review;

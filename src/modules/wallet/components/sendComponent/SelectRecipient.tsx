import { Box, Button, CaretDown, CaretUp, Dropdown, Text, TextInput } from "blocks";
import { TokenLogoComponent, truncateToDecimals } from "common";
import { css } from "styled-components";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { DestinationNetworkOption, useSendTokenContext } from "../../../../context/SendTokenContext";
import WalletHeader from "../dashboard/WalletHeader";
import { useTokenBalance } from "../../../../hooks/useTokenBalance";
import { usePushChain } from "../../../../context/PushChainContext";
import { getChainIcon } from "../OriginChainTokenListItem";
import { useState } from "react";

type RecipientNetworkSelectorProps = {
  canSelectDestinationNetwork: boolean;
  destinationNetworkOptions: DestinationNetworkOption[];
  selectedDestinationNetwork: DestinationNetworkOption;
  setDestinationNetwork: (network: DestinationNetworkOption['value']) => void;
};

const RecipientNetworkSelector = ({
  canSelectDestinationNetwork,
  destinationNetworkOptions,
  selectedDestinationNetwork,
  setDestinationNetwork,
}: RecipientNetworkSelectorProps) => {
  const isEnabled = canSelectDestinationNetwork && destinationNetworkOptions.length > 1;
  const [hoveredNetwork, setHoveredNetwork] = useState<DestinationNetworkOption['value'] | null>(null);

  const trigger = ({ isOpen = false }: { isOpen?: boolean } = {}) => (
    <Box
      display="flex"
      alignItems="center"
      gap="spacing-xxxs"
      cursor={isEnabled ? "pointer" : "not-allowed"}
      css={css`
        opacity: ${isEnabled ? 1 : 0.5};
        flex-shrink: 0;
      `}
    >
      {getChainIcon(selectedDestinationNetwork.chainId, 24)}
      {isEnabled && (
        isOpen ? (
          <CaretUp size={14} color="pw-int-icon-primary-color" />
        ) : (
          <CaretDown size={14} color="pw-int-icon-primary-color" />
        )
      )}
    </Box>
  );

  if (!isEnabled) return trigger();

  return (
    <Dropdown
      align="end"
      side="bottom"
      css={css`
        z-index: 5;
      `}
      overlay={(setIsOpen) => (
        <Box
          display="flex"
          flexDirection="column"
          backgroundColor="pw-int-bg-secondary-color"
          border="border-sm solid pw-int-border-secondary-color"
          borderRadius="radius-xs"
          overflow="hidden"
          boxShadow="0 12px 32px rgba(0, 0, 0, 0.12)"
          onMouseLeave={() => setHoveredNetwork(null)}
          css={css`
            width: 280px;
            max-width: calc(100vw - 48px);
          `}
        >
          {destinationNetworkOptions.map((option) => {
            const isSelected = option.value === selectedDestinationNetwork.value;
            const isActive = hoveredNetwork
              ? option.value === hoveredNetwork
              : isSelected;

            return (
              <Box
                key={option.value}
                display="flex"
                alignItems="center"
                gap="spacing-xs"
                padding="spacing-xs"
                cursor="pointer"
                backgroundColor={isActive ? "pw-int-bg-primary-color" : "pw-int-bg-secondary-color"}
                onMouseEnter={() => setHoveredNetwork(option.value)}
                onClick={() => {
                  setDestinationNetwork(option.value);
                  setIsOpen(false);
                }}
                css={css`
                  min-height: 44px;

                  &:hover {
                    background-color: var(--pw-int-bg-primary-color);
                  }
                `}
              >
                {getChainIcon(option.chainId, 28)}
                <Text variant="bm-regular" color="pw-int-text-primary-color">
                  {option.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    >
      {trigger}
    </Dropdown>
  );
};

const SelectRecipient = () => {
  const {
    walletAddress,
    tokenDetails,
    receiverAddress,
    setReceiverAddress,
    amount,
    setAmount,
    setSendState,
    setTokenDetails,
    nativeToken,
    nativeBalance,
    loadingNativeBalance,
    destinationNetworkOptions,
    selectedDestinationNetwork,
    setDestinationNetwork,
    canSelectDestinationNetwork
  } = useSendTokenContext();

  const { setActiveState } = useWalletDashboard();
  const { executorAddress } = usePushChain();

  const tokenSelected = tokenDetails.token;
  const balanceWalletDetails = tokenDetails.sourceWallet ?? null;
  const balanceWalletAddress = balanceWalletDetails?.address ?? executorAddress;
  const hasLoadedTokenBalance = tokenSelected?.balance !== undefined;
  const shouldFetchTokenBalance = !!tokenSelected && !tokenDetails.native && !hasLoadedTokenBalance;

  const {
    data: tokenBalance,
    isLoading: loadingTokenBalance
  } = useTokenBalance(
    tokenSelected?.address,
    balanceWalletAddress,
    tokenSelected?.decimals || 18,
    balanceWalletDetails,
    shouldFetchTokenBalance
  );

  const balance = tokenDetails.native ? nativeBalance : hasLoadedTokenBalance ? tokenSelected?.balance : tokenBalance;
  const loadingBalance = tokenDetails.native ? loadingNativeBalance : hasLoadedTokenBalance ? false : loadingTokenBalance;
  const tokenSymbol = tokenSelected?.symbol || nativeToken?.symbol || '';
  const shouldShowTokenLogo = !tokenDetails.native || !!tokenSelected;

  return (
    <>
      <WalletHeader
        walletAddress={walletAddress}
        handleBackButton={() => {
          setTokenDetails(null);
          setSendState("selectToken");
        }}
      />

      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        gap="spacing-md"
        css={css`
          flex: 1;
        `}
      >
        <Text variant="h3-semibold" color="pw-int-text-primary-color">
          Send {tokenSymbol}{" "}
        </Text>

        <Box
          display="flex"
          padding="spacing-xs"
          justifyContent="space-between"
          alignSelf="stretch"
          alignItems="center"
          borderRadius="radius-sm"
          border="border-sm solid pw-int-border-secondary-color"
          cursor="pointer"
        >
          <Box display="flex" gap="spacing-xxs" alignItems="center">
            {
              shouldShowTokenLogo ? (
                <TokenLogoComponent tokenSymbol={tokenSelected?.symbol || tokenSymbol} chainId={tokenDetails.chainId} />
              ) : (
                <Box position="relative" width="36px" height="36px" display="inline-block">
                  {getChainIcon(tokenDetails.chainId, 36)}
                  <Box
                    position="absolute"
                    width="18px"
                    height="18px"
                    backgroundColor="pw-int-bg-primary-color"
                    borderRadius="radius-lg"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="border-sm solid pw-int-border-secondary-color"
                    css={css`
                            bottom: 0;
                            right: 0;
                        `}
                  >
                    {getChainIcon(tokenDetails.chainId, 16)}
                  </Box>
                </Box>
              )
            }
            <Box display="flex" flexDirection="column">
              <Text variant="bm-semibold" color="pw-int-text-primary-color">
                {tokenSelected?.name || nativeToken?.name || ''}
              </Text>
              <Text variant="bs-regular" color="pw-int-text-secondary-color">
                {loadingBalance ? ('0') : Number(truncateToDecimals(Number(balance ?? '0'), 3)).toLocaleString()} {" "} {tokenSymbol}
              </Text>
            </Box>
          </Box>
        </Box>

        <Box
          borderRadius="radius-xs"
          width="100%"
          justifyContent="center"
          alignItems="baseline"
          display="flex"
          flexDirection="column"
          gap="spacing-xxs"
        >
          <TextInput
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            placeholder={`Recipient's ${selectedDestinationNetwork.label} Address`}
            trailingIcon={
              <RecipientNetworkSelector
                canSelectDestinationNetwork={canSelectDestinationNetwork}
                destinationNetworkOptions={destinationNetworkOptions}
                selectedDestinationNetwork={selectedDestinationNetwork}
                setDestinationNetwork={setDestinationNetwork}
              />
            }
            css={css`
              color: white;
              width: 100%;
            `}
          />
          <Text>
            Only send to {selectedDestinationNetwork.label} addresses. Other networks may result in lost tokens
          </Text>
        </Box>

        <Box
          display="flex"
          padding="spacing-xs spacing-sm"
          flexDirection="column"
          alignItems="flex-start"
          borderRadius="radius-sm"
          backgroundColor="pw-int-bg-tertiary-color"
        >
          <Text variant="bes-semibold" color="pw-int-text-primary-color">
            Tokens to Send
          </Text>
          <Box display="flex" alignItems="center" gap="spacing-sm" width="100%">
            <TextInput
              value={amount}
              type="number"
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              css={css`
                color: white;
                & input {
                  font-size: 26px !important;
                  &::-webkit-inner-spin-button,
                  &::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                  }
                  -moz-appearance: textfield;
                }
              `}
            />

            <Box
              display="flex"
              padding="spacing-xxs spacing-xs"
              alignItems="center"
              backgroundColor="pw-int-bg-secondary-color"
              borderRadius="radius-md"
              onClick={() => setAmount(truncateToDecimals(Number(balance), 3).toString())}
              cursor="pointer"
            >
              <Text variant="bs-semibold" color="pw-int-text-primary-color">
                Max
              </Text>
            </Box>
          </Box>
          <Box display="flex" width="100%">
            {/* <Box
              css={css`
                flex: 1;
              `}
            >
              <Text variant="bs-regular" color="pw-int-text-tertiary-color">
                ~$12.45
              </Text>
            </Box> */}
            <Box
              css={css`
                flex: 2;
              `}
            >
              <Text
                textAlign="right"
                variant="bs-regular"
                color="pw-int-text-tertiary-color"
              >
                Balance: {truncateToDecimals(Number(balance), 3)} {tokenSymbol}
              </Text>
            </Box>
          </Box>
        </Box>

        <Box
          display="flex"
          gap="spacing-xs"
          css={css`
            flex: 1;
          `}
          width="100%"
          alignItems="flex-end"
        >
          <Button
            variant="outline"
            css={css`
              flex: 1;
            `}
            onClick={() => setActiveState("walletDashboard")}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (receiverAddress && amount && !isNaN(Number(amount)) && Number(amount) > 0 && Number(amount) <= Number(balance)) {
                setSendState("review");
              }
            }}
            css={css`
              flex: 2;
            `}
            disabled={
              !receiverAddress ||
              !amount ||
              isNaN(Number(amount)) ||
              Number(amount) <= 0 ||
              Number(amount) > Number(balance)
            }
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default SelectRecipient;

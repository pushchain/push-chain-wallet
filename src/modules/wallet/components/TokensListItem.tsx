import { FC } from "react";
import { Box, Text } from "blocks";
import { TokenFormat, WalletType } from "../../../types";
import { TokenLogoComponent } from "common";
import { useTokenBalance } from "../../../hooks/useTokenBalance";
import { usePushChain } from "../../../context/PushChainContext";
import { formatTokenValue } from "../Wallet.utils";
import { Faucet } from "blocks";
import { css } from "styled-components";
import { useState } from "react";

type TokenListItemProps = {
  token: TokenFormat;
  walletDetails: WalletType | null;
  isMoveable?: boolean;
  handleSelectToken?: () => void;
  showFaucet?: boolean;
};

const TokensListItem: FC<TokenListItemProps> = ({ token, walletDetails, isMoveable = false, handleSelectToken, showFaucet = false }) => {
  const { executorAddress } = usePushChain();

  const [faucetHovered, setFaucetHovered] = useState(false);
  const shouldFetchTokenBalance = token.balance === undefined;

  const {
    data: fetchedTokenBalance,
    isLoading: fetchingTokenBalance
  } = useTokenBalance(token.address, executorAddress, token.decimals, isMoveable ? walletDetails : null, shouldFetchTokenBalance);

  const tokenBalance = shouldFetchTokenBalance ? fetchedTokenBalance : token.balance;
  const loadingTokenBalance = shouldFetchTokenBalance ? fetchingTokenBalance : false;

  if (!tokenBalance || tokenBalance === '0') {
    return null;
  }

  return (
    <Box
      display="flex"
      padding="spacing-xs"
      justifyContent="space-between"
      alignSelf="stretch"
      alignItems="center"
      borderRadius="radius-sm"
      border="border-sm solid pw-int-border-secondary-color"
      onClick={handleSelectToken}
      cursor={handleSelectToken && 'pointer'}
    >
      <Box display="flex" gap="spacing-xxs" alignItems="center">
        <TokenLogoComponent tokenSymbol={token.symbol} chainId={isMoveable ? walletDetails?.chainId : null} />
        <Box display="flex" flexDirection="column">
          <Text variant="bm-semibold" color="pw-int-text-primary-color">
            {token.name}
          </Text>
          <Box display="flex" gap="spacing-xxxs">
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              {loadingTokenBalance || !tokenBalance
                ? '0'
                : formatTokenValue(tokenBalance, 3)
              } {token.symbol}
            </Text>
            {showFaucet && (
              <Box
                display='flex'
                alignItems='center'
                borderRadius='radius-xs'
                padding='spacing-none spacing-xxxs'
                gap='spacing-xxxs'
                cursor='pointer'
                position='relative'
                onMouseEnter={() => setFaucetHovered(true)}
                onMouseLeave={() => setFaucetHovered(false)}
              >
                <Faucet size={16} color='pw-int-icon-primary-color' />
                {faucetHovered && (
                  <Text textTransform="capitalize" color="pw-int-text-tertiary-color" css={css`margin-left: 4px;`}>
                    Use for Gas
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* <Box
        display="flex"
        flexDirection="column"
        justifyContent="end"
        alignItems="end"
      >
        <Text variant="bm-semibold" color="pw-int-text-primary-color">
          ${Number("12045").toLocaleString()}
        </Text>
        <Text
          variant="c-semibold"
          color={
            "+1984".includes("+")
              ? "pw-int-text-success-bold-color"
              : "pw-int-text-danger-bold-color"
          }
        >
          +{Number("1984").toLocaleString()}
        </Text>
      </Box> */}
    </Box>
  );
};

export { TokensListItem };

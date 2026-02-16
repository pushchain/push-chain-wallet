import { FC } from "react";
import { Box, Text } from "blocks";
import { TokenFormat } from "../../../types";
import { TokenLogoComponent } from "common";
import { useTokenBalance } from "../../../hooks/useTokenBalance";
import { usePushChain } from "../../../hooks/usePushChain";
import { formatTokenValue } from "../Wallet.utils";

type TokenListItemProps = {
  token: TokenFormat;
  isPrc20?: boolean;
  handleSelectToken?: (token: TokenFormat) => void;
};

const TokensListItem: FC<TokenListItemProps> = ({ token, isPrc20, handleSelectToken }) => {

  const { executorAddress } = usePushChain();

  const {
    data: tokenBalance,
    isLoading: loadingTokenBalance
  } = useTokenBalance(token.address, executorAddress, token.decimals);

  if (isPrc20 && (!tokenBalance || tokenBalance === '0')) {
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
      onClick={() => handleSelectToken(token)}
      cursor={handleSelectToken && 'pointer'}
    >
      <Box display="flex" gap="spacing-xxs" alignItems="center">
        <TokenLogoComponent tokenSymbol={token.symbol} />
        <Box display="flex" flexDirection="column">
          <Text variant="bm-semibold" color="pw-int-text-primary-color">
            {token.name}
          </Text>
          <Text variant="bs-regular" color="pw-int-text-secondary-color">
            {loadingTokenBalance || !tokenBalance
              ? '0'
              : formatTokenValue(tokenBalance, 3)
            } {token.symbol}
          </Text>
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

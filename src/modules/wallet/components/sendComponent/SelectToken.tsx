import { Box, Button, Search, Spinner, Text, TextInput, WarningCircleFilled } from "blocks";
import React, { FC, useMemo, useState } from "react";
import { css } from "styled-components";
import { TokenFormat } from "../../../../types";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { TokenDetails, useSendTokenContext } from "../../../../context/SendTokenContext";
import WalletHeader from "../dashboard/WalletHeader";
import { useTokenManager } from "../../../../hooks/useTokenManager";
import { TokensListItem } from "../TokensListItem";
import { isAddress } from "viem";
import { truncateWords } from "common";
import { useGlobalState } from "../../../../context/GlobalContext";
import { convertCaipToObject, getWalletlist } from "../../Wallet.utils";
import { PushChain } from "@pushchain/core";
import OriginChainTokenList from "../OriginChainTokenList";
import { usePushChain } from "../../../../context/PushChainContext";

type SelectTokenProps = {
  handleTokenSelection: (tokenDetails: TokenDetails) => void;
};
const SelectToken: FC<SelectTokenProps> = ({ handleTokenSelection }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedToken, setSearchedToken] = useState<TokenFormat | null>(null);
  const [searchError, setSearchError] = useState("");
  const [loadingTokenDetails, setLoadingTokenDetails] = useState(false);
  const { setActiveState } = useWalletDashboard();

  const { walletAddress } = useSendTokenContext();
  const { state } = useGlobalState();
  const { executorAddress } = usePushChain();

  const { tokens, prc20Tokens, moveableTokens, fetchTokenDetails } = useTokenManager();

  const pushWallet = useMemo(() => getWalletlist(state.wallet)[0], [state.wallet]);
  const readOnlyWallet = state.pushWallet ? PushChain.utils.account.toChainAgnostic(state.pushWallet.address, { chain: state.pushWallet.chain }) : null;
  const parsedWallet = pushWallet?.fullAddress || readOnlyWallet || state?.externalWallet?.originAddress;

  const { result } = useMemo(() => convertCaipToObject(parsedWallet), [parsedWallet]);

  const availableTokens = useMemo(() => {
    const dedupedTokens = new Map<string, TokenFormat>();

    [...tokens, ...prc20Tokens].forEach((token) => {
      const tokenKey = token.address ? token.address.toLowerCase() : "native-token";

      if (!dedupedTokens.has(tokenKey)) {
        dedupedTokens.set(tokenKey, token);
      }
    });

    return Array.from(dedupedTokens.values());
  }, [tokens, prc20Tokens]);

  const otherTokens = useMemo(() => {
      return tokens.filter((t) => {
          const addr = (t?.address ?? '').toLowerCase();
          const existsInMoveable = moveableTokens.some((mt) => (mt?.address ?? '').toLowerCase() === addr);
          const existsInPrc20 = prc20Tokens.some((pt) => (pt?.address ?? '').toLowerCase() === addr);
          return !existsInMoveable && !existsInPrc20;
      });
  }, [tokens, moveableTokens, prc20Tokens]);

  const filteredTokens = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const tokensToFilter = searchedToken
      ? [
          searchedToken,
          ...availableTokens.filter(
            (token) => token.address.toLowerCase() !== searchedToken.address.toLowerCase()
          ),
        ]
      : availableTokens;

    if (!trimmedQuery) {
      return tokensToFilter;
    }

    return tokensToFilter.filter(
      (token) =>
        token.address.toLowerCase().includes(trimmedQuery) ||
        token.name.toLowerCase().includes(trimmedQuery) ||
        token.symbol.toLowerCase().includes(trimmedQuery)
    );
  }, [availableTokens, searchQuery, searchedToken]);

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();

    setSearchError("");

    if (!trimmedQuery) {
      setSearchedToken(null);
      return;
    }

    const existingToken = availableTokens.find(
      (token) => token.address && token.address.toLowerCase() === trimmedQuery.toLowerCase()
    );

    if (existingToken) {
      setSearchedToken(existingToken);
      return;
    }

    if (!isAddress(trimmedQuery)) {
      if (!filteredTokens.length) {
        setSearchError("No token found. Enter a valid token address to search.");
      }
      return;
    }

    setLoadingTokenDetails(true);

    try {
      const tokenDetails = await fetchTokenDetails(trimmedQuery as `0x${string}`);
      setSearchedToken(tokenDetails);
    } catch (error) {
      setSearchedToken(null);
      setSearchError(error instanceof Error ? error.message : "No token found");
    } finally {
      setLoadingTokenDetails(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <>
      <WalletHeader
        walletAddress={walletAddress}
        handleBackButton={() => setActiveState("walletDashboard")}
      />

      <Box display="flex" flexDirection="column" gap="spacing-sm">
        <Box
          borderRadius="radius-xs"
          width="100%"
          justifyContent="center"
          alignItems="baseline"
          onKeyDown={handleKeyPress}
          display="flex"
          flexDirection="column"
          gap="spacing-xxs"
        >
          <TextInput
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchError("");

              if (!e.target.value.trim()) {
                setSearchedToken(null);
              }
            }}
            icon={<Search />}
            placeholder="Search Token..."
            css={css`
              color: var(--pw-int-text-primary-color);
              width: 100%;
            `}
          />
          <Text>Search by token name, symbol, or press Enter with a token address</Text>
        </Box>

        {searchError && (
          <Box
            display="flex"
            backgroundColor="pw-int-bg-danger-bold"
            alignItems="center"
            padding="spacing-xs"
            borderRadius="radius-sm"
            gap="spacing-xxs"
          >
            <WarningCircleFilled color="pw-int-icon-danger-subtle-color" size={20} />
            <Text wrap variant="h5-semibold" color="pw-int-text-danger-subtle-color">
              {truncateWords(searchError, 10)}
            </Text>
          </Box>
        )}

        <Box display="flex" flexDirection="column" gap="spacing-xxs">
          <Box
            display="flex"
            flexDirection="column"
            gap="spacing-xs"
            overflow="hidden scroll"
            height="318px"
            customScrollbar
          >
            {loadingTokenDetails && <Spinner size="large" variant="primary" />}
            {/* {filteredTokens.map((token: TokenFormat) => (
              <TokensListItem
                token={token}
                key={token.address || token.symbol}
                handleSelectToken={handleTokenSelection}
              />
            ))} */}
            {executorAddress !== result.address && (
                <OriginChainTokenList
                    originWalletAddress={parsedWallet}
                    hideHeader
                    handleSelectToken={(_token, walletDetails) =>
                        handleTokenSelection({
                            token: null,
                            chainId: walletDetails.chainId,
                            native: true,
                            source: 'origin',
                            sourceWallet: walletDetails,
                        })
                    }
                />
            )}
            {otherTokens.map((token: TokenFormat) => (
                <TokensListItem
                    token={token}
                    key={token.address}
                    walletDetails={result}
                    handleSelectToken={() => handleTokenSelection({ token, chainId: '42101', native: false, source: 'push' })}
                />
            ))}
            {moveableTokens.filter(t => t.address !== "0x0000000000000000000000000000000000000000")
              .map((token: TokenFormat) => (
                  <TokensListItem token={token} key={token.address} walletDetails={result} isMoveable handleSelectToken={() => handleTokenSelection({ token, chainId: result.chainId, native: false, source: 'origin', sourceWallet: result })} />
            ))}
            {prc20Tokens.filter(t => t.address !== "0x0000000000000000000000000000000000000000")
              .map((token: TokenFormat) => (
                  <TokensListItem token={token} key={token.address} walletDetails={null} handleSelectToken={() => handleTokenSelection({ token, chainId: '42101', native: false, source: 'push' })} />
            ))}
            {!loadingTokenDetails && !filteredTokens.length && !searchError && (
              <Text variant="bs-regular" color="pw-int-text-secondary-color">
                No matching tokens yet. Enter a contract address and press Enter to load one.
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      <Box
        display="flex"
        css={css`
          flex: 1;
        `}
        alignItems="flex-end"
      >
        <Button onClick={() => setActiveState("walletDashboard")} block>
          Close
        </Button>
      </Box>
    </>
  );
};

export { SelectToken };

import {
  ComponentProps,
  FC,
  ReactElement,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  CaretDown,
  CaretUp,
  Cross,
  Dropdown,
  Search,
  Text,
} from 'blocks';
import { TokenLogoComponent } from 'common';
import styled, { css } from 'styled-components';
import { getChainIcon } from 'common';
import { usePushChain } from '../../../../context/PushChainContext';
import { formatTokenValue } from '../../Wallet.utils';
import { getSwapTokenKey } from './swap.balances';
import { SwapChain, SwapToken } from './swap.types';
import {
  getSwapChainDisplayName,
  getSwapTokenDisplaySymbol,
  getSupportedSwapChains,
  isPushChain,
} from './swap.utils';
import { useSwapTokenBalances } from './useSwapTokenBalances';

type SwapTokenSelectorProps = {
  title?: string;
  chains: SwapChain[];
  selectedToken: SwapToken | null;
  getTokens: (chain: SwapChain) => SwapToken[];
  onSelect: (token: SwapToken) => void;
  onClose: () => void;
};

type RenderPropDropdownProps = Omit<
  ComponentProps<typeof Dropdown>,
  'children'
> & {
  children: (props: { isOpen: boolean }) => ReactElement;
};

// Radix's content props also declare `children`, producing an impossible
// render-function/ReactNode intersection in the shared Dropdown type.
const RenderPropDropdown =
  Dropdown as unknown as FC<RenderPropDropdownProps>;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALL_CHAINS_KEY = '__all_chains__';

const SearchInput = styled.input`
  min-width: 0;
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--pw-int-text-primary-color);
  font-family: var(--pw-int-font-family);
  font-size: var(--pw-int-text-body-large-size);
  font-weight: 400;
  line-height: 22px;

  &::placeholder {
    color: var(--pw-int-text-tertiary-color);
  }
`;

const getChainLogoKey = (chain: SwapChain) => {
  const separatorIndex = chain.indexOf(':');
  return separatorIndex >= 0 ? chain.slice(separatorIndex + 1) : chain;
};

const getChainSortOrder = (chain: SwapChain) => {
  const reference = getChainLogoKey(chain);
  if (reference === '11155111') return 0;
  if (isPushChain(chain) || reference === '42101') return 1;
  if (chain.startsWith('solana:')) return 2;
  if (reference === '97') return 3;
  if (reference === '84532') return 4;
  if (reference === '421614') return 5;
  return 6;
};

const getTokenDisplayName = (token: SwapToken) => {
  const baseSymbol = getSwapTokenDisplaySymbol(token.symbol);
  const suffix = token.symbol.match(/[._](arb|base|bnb|bsc|eth|sol)$/i)?.[1];
  const bridgeNetworkNames: Record<string, string> = {
    arb: 'Arbitrum',
    base: 'Base',
    bnb: 'BNB',
    bsc: 'BNB',
    eth: 'Ethereum',
    sol: 'Solana',
  };

  if (baseSymbol.toLowerCase() === 'peth') return 'Bridged Ethereum';
  if (baseSymbol.toLowerCase() === 'psol') return 'Bridged Solana';
  if (baseSymbol.toLowerCase() === 'pbnb') return 'Bridged BNB';
  if (baseSymbol === 'WETH') return 'Wrapped Ethereum';
  if (suffix && (baseSymbol === 'USDC' || baseSymbol === 'USDT')) {
    return `${bridgeNetworkNames[suffix.toLowerCase()]} Bridged ${baseSymbol}`;
  }
  if (baseSymbol === 'ETH') return 'Ethereum';
  if (baseSymbol === 'SOL') return 'Solana';
  if (baseSymbol === 'BNB') return 'BNB';
  if (baseSymbol === 'USDT') return 'Tether USD';

  return token.name || baseSymbol;
};

const truncateTokenAddress = (address: string) => {
  if (!address || address.toLowerCase() === ZERO_ADDRESS) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const isPeggedToken = (token: SwapToken) => {
  if (!isPushChain(token.chain)) return false;
  const baseSymbol = getSwapTokenDisplaySymbol(token.symbol).toLowerCase();
  return (
    token.symbol.includes('.') ||
    token.symbol.includes('_') ||
    ['peth', 'psol', 'pbnb', 'ppol'].includes(baseSymbol)
  );
};

const AllChainsIcon: FC<{ chains: SwapChain[]; size?: number }> = ({
  chains,
  size = 28,
}) => {
  const iconChains = chains
    .filter((chain) => !isPushChain(chain))
    .slice(0, 4);

  return (
    <Box
      width={`${size}px`}
      height={`${size}px`}
      css={css`
        flex-shrink: 0;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        gap: 2px;
      `}
    >
      {iconChains.map((chain) => (
        <Box
          key={chain}
          width={`${Math.floor((size - 2) / 2)}px`}
          height={`${Math.floor((size - 2) / 2)}px`}
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="radius-round"
          overflow="hidden"
        >
          {getChainIcon(
            getChainLogoKey(chain),
            Math.floor((size - 2) / 2),
          )}
        </Box>
      ))}
    </Box>
  );
};

const SwapTokenSelector: FC<SwapTokenSelectorProps> = ({
  title = 'Select a token',
  chains,
  selectedToken,
  getTokens,
  onSelect,
  onClose,
}) => {
  const { executorAddress, pushChainClient } = usePushChain();
  const [activeChain, setActiveChain] = useState<SwapChain | null>(null);
  const [search, setSearch] = useState('');
  const [hoveredChainKey, setHoveredChainKey] = useState<string | null>(null);
  const [hoveredTokenKey, setHoveredTokenKey] = useState<string | null>(null);

  const availableChains = useMemo(() => {
    let supportedChains: SwapChain[] = [];
    try {
      supportedChains = getSupportedSwapChains();
    } catch {
      // The explicitly supplied chains remain usable if SDK discovery fails.
    }

    return Array.from(new Set([...chains, ...supportedChains])).sort(
      (first, second) =>
        getChainSortOrder(first) - getChainSortOrder(second),
    );
  }, [chains]);
  const tokenBalances = useSwapTokenBalances({
    chains: availableChains,
    executorAddress,
    origin: pushChainClient?.universal.origin,
    enabled: availableChains.length > 0,
  });

  const tokens = useMemo(() => {
    const query = search.trim().toLowerCase();
    const unfilteredTokens = activeChain
      ? getTokens(activeChain)
      : availableChains.flatMap((chain) => getTokens(chain));
    const uniqueTokens = Array.from(
      new Map(
        unfilteredTokens.map((token) => [
          getSwapTokenKey(token),
          token,
        ]),
      ).values(),
    );

    return uniqueTokens.filter((token) => {
      const displayName = getTokenDisplayName(token).toLowerCase();
      return (
        !query ||
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        displayName.includes(query)
      );
    });
  }, [activeChain, availableChains, getTokens, search]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      padding="spacing-sm"
      gap="spacing-sm"
      backgroundColor="pw-int-bg-primary-color"
      borderRadius="radius-sm"
      border="border-sm solid pw-int-border-secondary-color"
      css={css`
        width: calc(100% + (2 * var(--spacing-md)));
        margin-right: calc(-1 * var(--spacing-md));
        margin-bottom: calc(-1 * var(--spacing-md));
        margin-left: calc(-1 * var(--spacing-md));
        flex: 1 1 auto;
        height: clamp(360px, calc(100vh - 148px), 540px);
        min-height: 0;
        box-sizing: border-box;
        overflow: hidden;
      `}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Text variant="h4-semibold">{title}</Text>
        <Box
          cursor="pointer"
          display="flex"
          width="32px"
          height="32px"
          alignItems="center"
          justifyContent="center"
          onClick={onClose}
          aria-label="Close token selector"
        >
          <Cross size={20} color="pw-int-icon-primary-color" />
        </Box>
      </Box>

      <Box
        display="flex"
        alignItems="center"
        width="100%"
        height="56px"
        padding="spacing-xs"
        gap="spacing-xxs"
        borderRadius="radius-sm"
        border="border-sm solid pw-int-border-secondary-color"
        backgroundColor="pw-int-bg-tertiary-color"
        css={css`
          box-sizing: border-box;

          &:focus-within {
            border-color: var(--pw-int-brand-primary-subtle-color);
          }
        `}
      >
        <Search size={28} color="pw-int-icon-tertiary-color" />
        <SearchInput
          value={search}
          placeholder="Search tokens"
          aria-label="Search tokens"
          onChange={(event) => setSearch(event.target.value)}
        />

        <RenderPropDropdown
          align="end"
          side="bottom"
          sideOffset={6}
          alignOffset={-12}
          onEscapeKeyDown={() => setHoveredChainKey(null)}
          onPointerDownOutside={() => setHoveredChainKey(null)}
          css={css`
            z-index: 30;
          `}
          overlay={(setIsOpen) => (
            <Box
              display="flex"
              flexDirection="column"
              width="240px"
              backgroundColor="pw-int-bg-secondary-color"
              border="border-sm solid pw-int-border-secondary-color"
              borderRadius="radius-xs"
              overflow="hidden"
              boxShadow="0 12px 32px rgba(0, 0, 0, 0.18)"
              onMouseLeave={() => setHoveredChainKey(null)}
              css={css`
                max-width: calc(100vw - 64px);
              `}
            >
              <Box
                display="flex"
                alignItems="center"
                gap="spacing-xs"
                minHeight="48px"
                padding="spacing-xxs spacing-xs"
                cursor="pointer"
                backgroundColor={
                  (hoveredChainKey !== null
                    ? hoveredChainKey === ALL_CHAINS_KEY
                    : activeChain === null)
                    ? 'pw-int-bg-tertiary-color'
                    : 'pw-int-bg-secondary-color'
                }
                onMouseEnter={() => setHoveredChainKey(ALL_CHAINS_KEY)}
                onMouseLeave={() => setHoveredChainKey(null)}
                onClick={() => {
                  setActiveChain(null);
                  setHoveredChainKey(null);
                  setIsOpen(false);
                }}
              >
                <AllChainsIcon chains={availableChains} size={24} />
                <Text variant="bm-regular">All Chains</Text>
              </Box>

              {availableChains.map((chain) => (
                <Box
                  key={chain}
                  display="flex"
                  alignItems="center"
                  gap="spacing-xs"
                  minHeight="48px"
                  padding="spacing-xxs spacing-xs"
                  cursor="pointer"
                  backgroundColor={
                    (hoveredChainKey !== null
                      ? hoveredChainKey === chain
                      : activeChain === chain)
                      ? 'pw-int-bg-tertiary-color'
                      : 'pw-int-bg-secondary-color'
                  }
                  onMouseEnter={() => setHoveredChainKey(chain)}
                  onMouseLeave={() => setHoveredChainKey(null)}
                  onClick={() => {
                    setActiveChain(chain);
                    setHoveredChainKey(null);
                    setIsOpen(false);
                  }}
                >
                  <Box
                    display="flex"
                    width="24px"
                    height="24px"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="radius-round"
                    overflow="hidden"
                    css={css`
                      flex-shrink: 0;
                    `}
                  >
                    {getChainIcon(getChainLogoKey(chain), 24)}
                  </Box>
                  <Text variant="bm-regular">
                    {getSwapChainDisplayName(chain)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        >
          {({ isOpen }) => (
            <Box
              display="flex"
              alignItems="center"
              gap="spacing-xxs"
              padding="spacing-xxxs"
              cursor="pointer"
              aria-label="Filter tokens by chain"
              css={css`
                flex-shrink: 0;
              `}
            >
              {activeChain ? (
                <Box
                  display="flex"
                  width="28px"
                  height="28px"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="radius-round"
                  overflow="hidden"
                >
                  {getChainIcon(getChainLogoKey(activeChain), 28)}
                </Box>
              ) : (
                <AllChainsIcon chains={availableChains} />
              )}
              {isOpen ? (
                <CaretUp size={20} color="pw-int-icon-primary-color" />
              ) : (
                <CaretDown size={20} color="pw-int-icon-primary-color" />
              )}
            </Box>
          )}
        </RenderPropDropdown>
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        overflow="hidden"
        customScrollbar
        css={css`
          flex: 1;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
        `}
      >
        {tokens.map((token) => {
          const tokenKey = getSwapTokenKey(token);
          const active =
            !!selectedToken &&
            tokenKey === getSwapTokenKey(selectedToken);
          const highlighted =
            hoveredTokenKey !== null
              ? hoveredTokenKey === tokenKey
              : active;
          const balanceState = tokenBalances.getTokenState(token);
          const balanceLabel =
            !executorAddress || !pushChainClient?.universal.origin
              ? '—'
              : balanceState.isLoading
                ? '…'
                : balanceState.isError
                  ? '—'
                  : formatTokenValue(balanceState.balance ?? '0', 5);
          return (
            <Box
              key={tokenKey}
              display="flex"
              alignItems="center"
              gap="spacing-xs"
              padding="spacing-xxs"
              minHeight="56px"
              borderRadius="radius-xxs"
              cursor="pointer"
              backgroundColor={
                highlighted
                  ? 'pw-int-bg-secondary-color'
                  : 'pw-int-bg-primary-color'
              }
              onMouseEnter={() => setHoveredTokenKey(tokenKey)}
              onMouseLeave={() => setHoveredTokenKey(null)}
              onClick={() => onSelect(token)}
              css={css`
                width: 100%;
                box-sizing: border-box;
              `}
            >
              <TokenLogoComponent
                tokenSymbol={getSwapTokenDisplaySymbol(token.symbol)}
                chainId={getChainLogoKey(token.chain)}
              />
              <Box
                display="flex"
                flexDirection="column"
                gap="spacing-xxxs"
                css={css`
                  min-width: 0;
                  flex: 1;
                `}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  gap="spacing-xxs"
                  css={css`
                    min-width: 0;
                    overflow: hidden;
                  `}
                >
                  <Text
                    variant="bm-semibold"
                    ellipsis
                    css={css`
                      flex: 1;
                      min-width: 0;
                    `}
                  >
                    {getTokenDisplayName(token)}
                  </Text>
                  {isPeggedToken(token) && (
                    <Text
                      variant="cs-semibold"
                      color="pw-int-text-info-bold-color"
                      css={css`
                        flex-shrink: 0;
                        padding: 2px 6px;
                        border-radius: var(--radius-xxxs);
                        background: var(--pw-int-bg-info-subtle);
                      `}
                    >
                      1:1 PEGGED
                    </Text>
                  )}
                </Box>
                <Box display="flex" gap="spacing-xxs">
                  <Text
                    variant="bes-regular"
                    color="pw-int-text-tertiary-color"
                  >
                    {getSwapTokenDisplaySymbol(token.symbol)}
                  </Text>
                  {truncateTokenAddress(token.address) && (
                    <Text
                      variant="bes-regular"
                      color="pw-int-text-tertiary-color"
                      ellipsis
                    >
                      {truncateTokenAddress(token.address)}
                    </Text>
                  )}
                </Box>
              </Box>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="flex-end"
                minWidth="64px"
                maxWidth="80px"
                title={
                  balanceState.balance !== undefined &&
                  !balanceState.isError
                    ? `${balanceState.balance} ${getSwapTokenDisplaySymbol(
                        token.symbol,
                      )}`
                    : undefined
                }
                aria-label={`${balanceLabel} ${getSwapTokenDisplaySymbol(
                  token.symbol,
                )} balance`}
                css={css`
                  flex-shrink: 0;
                `}
              >
                <Text
                  variant="bes-regular"
                  color="pw-int-text-tertiary-color"
                  fullWidth
                  textAlign="right"
                  ellipsis
                >
                  {balanceLabel}
                </Text>
              </Box>
            </Box>
          );
        })}
        {!tokens.length && (
          <Box padding="spacing-lg" textAlign="center">
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              {search.trim()
                ? 'No tokens found'
                : 'No tokens available for this chain'}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export { SwapTokenSelector };

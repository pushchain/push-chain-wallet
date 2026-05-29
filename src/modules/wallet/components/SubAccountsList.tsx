import { FC, useEffect, useMemo, useState } from 'react';
import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import type { MoveableToken } from '@pushchain/core/src/lib/constants';
import { PublicKey } from '@solana/web3.js';
import styled, { css } from 'styled-components';

import {
    Box,
    CaretDown,
    CopyFilled,
    Skeleton,
    Text,
    TickCircleFilled,
} from 'blocks';
import {
    centerMaskWalletAddress,
    CHAIN_MONOTONE_LOGO,
    handleCopy,
    TOKEN_LOGO,
} from 'common';
import { useWalletDashboard } from '../../../context/WalletDashboardContext';
import { usePushChain } from '../../../context/PushChainContext';
import { fetchTokenBalance } from '../../../helpers/TokenHelper';
import { TokenFormat, WalletType } from '../../../types';
import { getAddressExplorerUrl } from '../../../utils/explorer';
import { formatTokenValue, getNativeTokenBalance } from '../Wallet.utils';

type SubAccountToken = {
    token: MoveableToken;
    balance: string;
};

type SubAccount = {
    chain: CHAIN;
    chainId: string | null;
    chainName: string;
    address: string;
    tokens: SubAccountToken[];
};

type MoveableTokenWithChain = MoveableToken & {
    chain?: CHAIN;
    chainName?: string;
};

const PUSH_CHAIN = CHAIN.PUSH_TESTNET_DONUT;
const POLL_MS = 15_000;
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

const TOKEN_NAMES: Record<string, string> = {
    ETH: 'Ethereum',
    BNB: 'BNB',
    SOL: 'Solana',
    USDT: 'Tether USD',
    USDC: 'USDC',
    WETH: 'Wrapped ETH',
    stETH: 'Staked ETH',
    DAI: 'Dai',
};

const CHAIN_NAMES: Partial<Record<CHAIN, string>> = {
    [CHAIN.ETHEREUM_SEPOLIA]: 'Ethereum',
    [CHAIN.ARBITRUM_SEPOLIA]: 'Arbitrum',
    [CHAIN.BASE_SEPOLIA]: 'Base',
    [CHAIN.BNB_TESTNET]: 'BNB',
    [CHAIN.SOLANA_DEVNET]: 'Solana',
};

const getChainId = (chain: CHAIN) => chain.split(':')[1] || null;

const getChainNamespace = (chain: CHAIN) => chain.split(':')[0] || null;

const isSolanaChain = (chain: CHAIN) => getChainNamespace(chain) === 'solana';

const isNativeToken = (token: MoveableToken) =>
    token.mechanism === 'native' ||
    !token.address ||
    token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;

const toTokenFormat = (token: MoveableToken): TokenFormat => ({
    name: TOKEN_NAMES[token.symbol] || token.symbol,
    symbol: token.symbol,
    address: isNativeToken(token) ? '' : token.address || '',
    decimals: token.decimals,
});

const normalizeBalance = (value?: string | number | null) =>
    String(value ?? '0').replace(/,/g, '').trim();

const hasPositiveBalance = (value: string) => {
    const parsed = Number(normalizeBalance(value));
    return Number.isFinite(parsed) && parsed > 0;
};

const hexToBytes = (hex: string) => {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = cleanHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
    return new Uint8Array(bytes ?? []);
};

const toDisplayAddress = (chain: CHAIN, address: string) => {
    if (!isSolanaChain(chain) || !address.startsWith('0x')) return address;

    try {
        return new PublicKey(hexToBytes(address)).toBase58();
    } catch (error) {
        console.error('Failed to convert Solana CEA address:', error);
        return address;
    }
};

const getWalletDetails = (chain: CHAIN, address: string): WalletType => ({
    chain: getChainNamespace(chain),
    chainId: getChainId(chain),
    address,
});

const getChainName = (chain: CHAIN) => {
    if (CHAIN_NAMES[chain]) return CHAIN_NAMES[chain];

    const sdkName = PushChain.utils.chains.getChainName(chain) || chain;
    return sdkName
        .replace(/_(SEPOLIA|TESTNET|DEVNET|DONUT)$/g, '')
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
};

const fetchSubAccountTokenBalance = async (
    token: MoveableToken,
    walletDetails: WalletType,
) => {
    if (isNativeToken(token)) {
        const nativeToken = { ...token, address: '' };
        const result = await getNativeTokenBalance(nativeToken, walletDetails);
        return normalizeBalance(result.balance);
    }

    return normalizeBalance(
        await fetchTokenBalance({
            walletAddress: walletDetails.address as `0x${string}`,
            tokenAddress: token.address as `0x${string}`,
            decimals: token.decimals,
            walletDetails,
        }),
    );
};

const buildSubAccount = async (
    chain: CHAIN,
    ueaAddress: `0x${string}`,
): Promise<SubAccount> => {
    const derivedAccount = await PushChain.utils.account.deriveExecutorAccount(
        {
            chain: PUSH_CHAIN,
            address: ueaAddress,
        },
        {
            chain,
            skipNetworkCheck: true,
        },
    );
    const address = toDisplayAddress(chain, derivedAccount.address);
    const walletDetails = getWalletDetails(chain, address);
    const moveableTokens = PushChain.utils.tokens.getMoveableTokens(chain)
        .tokens as MoveableTokenWithChain[];

    const tokens = await Promise.all(
        moveableTokens.map(async (token) => {
            try {
                const balance = await fetchSubAccountTokenBalance(
                    token,
                    walletDetails,
                );

                if (!hasPositiveBalance(balance)) return null;

                return {
                    token,
                    balance,
                };
            } catch (error) {
                console.error(
                    `Failed to fetch ${token.symbol} balance for ${chain}:`,
                    error,
                );
                return null;
            }
        }),
    );

    return {
        chain,
        chainId: getChainId(chain),
        chainName: getChainName(chain),
        address,
        tokens: tokens.filter(Boolean) as SubAccountToken[],
    };
};

const SubAccountsList: FC = () => {
    const { pushChainClient } = usePushChain();
    const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
    const [expandedChain, setExpandedChain] = useState<CHAIN | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const supportedSubAccountChains = useMemo(() => {
        if (!pushChainClient) return [];

        return PushChain.utils.chains
            .getSupportedChains(PushChain.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT)
            .chains.filter((chain) => chain !== PUSH_CHAIN);
    }, [pushChainClient]);

    useEffect(() => {
        let cancelled = false;

        const loadSubAccounts = async (showLoading = false) => {
            if (!pushChainClient) {
                setSubAccounts([]);
                setExpandedChain(null);
                setError('');
                return;
            }

            if (showLoading) setIsLoading(true);
            setError('');

            try {
                const ueaAddress =
                    pushChainClient.universal.account as `0x${string}`;
                const accounts = await Promise.all(
                    supportedSubAccountChains.map(async (chain) => {
                        try {
                            return await buildSubAccount(chain, ueaAddress);
                        } catch (accountError) {
                            console.error(
                                `Failed to load sub-account for ${chain}:`,
                                accountError,
                            );
                            return null;
                        }
                    }),
                );

                if (!cancelled) {
                    setSubAccounts(accounts.filter(Boolean) as SubAccount[]);
                }
            } catch (loadError) {
                console.error('Failed to load sub-accounts:', loadError);
                if (!cancelled) setError('Unable to load sub-accounts');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadSubAccounts(true);
        const intervalId = window.setInterval(
            () => loadSubAccounts(false),
            POLL_MS,
        );

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [pushChainClient, supportedSubAccountChains]);

    useEffect(() => {
        if (
            expandedChain &&
            !subAccounts.some((subAccount) => subAccount.chain === expandedChain)
        ) {
            setExpandedChain(null);
        }
    }, [expandedChain, subAccounts]);

    if (isLoading && !subAccounts.length) {
        return <SubAccountsSkeleton />;
    }

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="spacing-xs"
            overflow="hidden scroll"
            height="280px"
            customScrollbar
            css={css`
                overflow-x: hidden;
                overflow-y: auto;
                padding-right: 6px;
                margin-right: -8px;
            `}
        >
            {error ? (
                <SubAccountsStateLabel label={error} />
            ) : subAccounts.length ? (
                <>
                    <Text
                        variant="c-regular"
                        color="pw-int-text-tertiary-color"
                        wrap
                        css={css`
                            flex: 0 0 auto;
                        `}
                    >
                        Smart sub-accounts linked to your Push wallet to hold
                        assets and execute transactions across different chains.
                    </Text>
                    {subAccounts.map((subAccount) => (
                        <SubAccountCard
                            key={subAccount.chain}
                            subAccount={subAccount}
                            expanded={expandedChain === subAccount.chain}
                            onToggle={() =>
                                setExpandedChain((currentChain) =>
                                    currentChain === subAccount.chain
                                        ? null
                                        : subAccount.chain,
                                )
                            }
                        />
                    ))}
                </>
            ) : (
                <SubAccountsStateLabel label="No sub-account balances" />
            )}
        </Box>
    );
};

const SubAccountsSkeleton = () => (
    <Box display="flex" flexDirection="column" gap="spacing-xs">
        {[0, 1, 2, 3].map((item) => (
            <Skeleton
                key={item}
                isLoading
                height="48px"
                borderRadius="radius-sm"
            >
                <Box height="48px" />
            </Skeleton>
        ))}
    </Box>
);

const SubAccountsStateLabel = ({ label }: { label: string }) => (
    <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="180px"
    >
        <Text variant="bs-regular" color="pw-int-text-tertiary-color">
            {label}
        </Text>
    </Box>
);

const SubAccountCard = ({
    subAccount,
    expanded,
    onToggle,
}: {
    subAccount: SubAccount;
    expanded: boolean;
    onToggle: () => void;
}) => {
    const [copied, setCopied] = useState(false);
    const { startSendFlow } = useWalletDashboard();

    const IconComponent = CHAIN_MONOTONE_LOGO[subAccount.chainId];

    const handleToggle = () => {
        onToggle();
    };

    const handleCopyClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        handleCopy(subAccount.address, setCopied);
    };

    const handleAddressClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        window.open(
            getAddressExplorerUrl(subAccount.chain, subAccount.address),
            '_blank',
        );
    };

    const handleTokenClick = (token: MoveableToken) => {
        startSendFlow({
            token: toTokenFormat(token),
            chainId: subAccount.chainId ?? undefined,
            native: isNativeToken(token),
            source: 'cea',
            sourceWallet: getWalletDetails(subAccount.chain, subAccount.address),
            sourceChain: subAccount.chain,
            moveableToken: token,
        });
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            borderRadius="radius-sm"
            border="border-sm solid pw-int-border-secondary-color"
            backgroundColor={
                expanded ? 'pw-int-bg-primary-color' : 'pw-int-bg-secondary-color'
            }
            overflow="hidden"
            css={css`
                flex: 0 0 auto;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease;

            `}
        >
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="spacing-xs"
                padding="spacing-xs"
                cursor="pointer"
                onClick={handleToggle}
            >
                <Box
                    display="flex"
                    alignItems="center"
                    gap="spacing-xxs"
                    minWidth="0"
                >
                    <Box width="24px" height="24px" display="flex">
                        <IconComponent size={24} />
                    </Box>
                    <Text
                        variant="bs-semibold"
                        color="pw-int-text-primary-color"
                        ellipsis
                    >
                        {subAccount.chainName}
                    </Text>
                </Box>

                <AddressRow
                    display="flex"
                    alignItems="center"
                    gap="spacing-xxxs"
                    minWidth="0"
                >
                    <Box
                        display="flex"
                        cursor="pointer"
                        alignItems="center"
                        onClick={handleAddressClick}
                        minWidth="0"
                    >
                        <Text
                            variant="bes-semibold"
                            color="pw-int-text-secondary-color"
                            ellipsis
                            css={css`
                                &:hover {
                                    color: var(--pw-int-brand-primary-color);
                                }
                            `}
                        >
                            {centerMaskWalletAddress(subAccount.address, 6)}
                        </Text>
                    </Box>
                    <Box
                        display="flex"
                        cursor="pointer"
                        className="copy-icon"
                        onClick={handleCopyClick}
                    >
                        {copied ? (
                            <TickCircleFilled
                                size={12}
                                color="pw-int-icon-success-bold-color"
                            />
                        ) : (
                            <CopyFilled
                                size={12}
                                color="pw-int-icon-tertiary-color"
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.color =
                                        'var(--pw-int-icon-brand-color)')
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.color =
                                        'var(--pw-int-icon-tertiary-color)')
                                }
                            />
                        )}
                    </Box>
                    <Box
                        display="flex"
                        css={css`
                            transform: rotate(${expanded ? '180deg' : '0deg'});
                            transition: transform 0.15s ease;
                        `}
                    >
                        <CaretDown
                            size={14}
                            color="pw-int-icon-primary-color"
                        />
                    </Box>
                </AddressRow>
            </Box>

            {expanded ? (
                <Box
                    display="flex"
                    flexDirection="column"
                    padding="spacing-none spacing-xs spacing-xs spacing-xs"
                    css={css`
                        flex: 0 0 auto;
                        overflow: visible;
                    `}
                >
                    {subAccount.tokens.length ? (
                        subAccount.tokens.map((tokenBalance, index) => (
                            <SubAccountTokenRow
                                key={`${subAccount.chain}-${tokenBalance.token.address || tokenBalance.token.symbol}`}
                                tokenBalance={tokenBalance}
                                showDivider={index > 0}
                                onClick={() =>
                                    handleTokenClick(tokenBalance.token)
                                }
                            />
                        ))
                    ) : (
                        <NoTokenBalancesMessage />
                    )}
                </Box>
            ) : null}
        </Box>
    );
};

const SubAccountTokenRow = ({
    tokenBalance,
    showDivider,
    onClick,
}: {
    tokenBalance: SubAccountToken;
    showDivider: boolean;
    onClick: () => void;
}) => {
    const { token, balance } = tokenBalance;
    const tokenName = TOKEN_NAMES[token.symbol] || token.symbol;

    const IconComponent = TOKEN_LOGO[token.symbol];

    return (
        <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap="spacing-xs"
            padding="spacing-xs spacing-none"
            cursor="pointer"
            onClick={onClick}
            css={css`
                flex: 0 0 auto;
                border-top: ${showDivider
                    ? 'var(--border-sm) solid var(--pw-int-border-tertiary-color)'
                    : 'none'};
                &:hover {
                    color: var(--pw-int-brand-primary-color);
                }
            `}
        >
            <Box
                display="flex"
                alignItems="center"
                gap="spacing-xxs"
                minWidth="0"
            >
                <IconComponent width={24} height={24} />
                <Text
                    variant="h6-semibold"
                    color="pw-int-text-primary-color"
                    ellipsis
                >
                    {tokenName}
                </Text>
            </Box>

            <Text
                variant="bes-regular"
                color="pw-int-text-secondary-color"
                textAlign="right"
                ellipsis
            >
                {formatTokenValue(balance, 4)} {token.symbol}
            </Text>
        </Box>
    );
};

const NoTokenBalancesMessage = () => (
    <Box
        display="flex"
        padding="spacing-xs spacing-none"
        css={css`
            flex: 0 0 auto;
        `}
    >
        <Text variant="bes-regular" color="pw-int-text-tertiary-color">
            No tokens with balances exist for this sub-account.
        </Text>
    </Box>
);

const AddressRow = styled(Box)`
    .copy-icon {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
    }

    &:hover .copy-icon {
        opacity: 1;
        pointer-events: auto;
    }
`;

export { SubAccountsList };

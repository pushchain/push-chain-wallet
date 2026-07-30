import { Box, DefaultChainMonotone, Doc, ExternalLinkIcon, InternalLink, PushChainMonotone, Text } from '../../../../blocks';
import { css } from 'styled-components';
import { convertCaipToObject } from '../../Wallet.utils';
import { centerMaskWalletAddress, CHAIN_MONOTONE_LOGO } from '../../../../common';

import { FC, ReactNode } from 'react';
import { formatUnits } from 'viem';
import useUEAOrigin from '../../../../hooks/useUEAOrigin';
import { TransactionType } from '../../Wallet.types';
import {
    WalletActivitiesResponse,
    WalletActivityAddress,
    WalletActivityTokenTransfer,
} from '../../../../types/walletactivities.types';
import {
    getActivityTokenDisplaySymbol,
    getRelevantActivityTokenTransfer,
    getVerifiedActivityAddressName,
} from './walletActivityDisplay';

type WalletActivityListItemProps = {
    transaction: WalletActivitiesResponse
    addresses: string[]
}

const WalletActivityListItem: FC<WalletActivityListItemProps> = ({
    transaction,
    addresses,
}) => {
    const displayTransfer = getDisplayTransfer(transaction, addresses);

    const transactionTargetAddress =
        getAddressHash(transaction.to) || getAddressHash(transaction.created_contract);
    const counterpartyUEAAddress = getUEACheckAddress(displayTransfer.counterpartyAddress);
    const targetUEAAddress = getUEACheckAddress(transactionTargetAddress);
    const shouldCheckTargetOrigin =
        !!targetUEAAddress &&
        !isSameAddress(targetUEAAddress, counterpartyUEAAddress);
    const {
        ueaOrigin: counterpartyOrigin,
        isLoading: isCounterpartyOriginLoading,
    } = useUEAOrigin(counterpartyUEAAddress);
    const {
        ueaOrigin: targetOrigin,
        isLoading: isTargetOriginLoading,
    } = useUEAOrigin(shouldCheckTargetOrigin ? targetUEAAddress : undefined);
    const isResolvingUniversalTransaction =
        (!!counterpartyUEAAddress && isCounterpartyOriginLoading) ||
        (shouldCheckTargetOrigin && isTargetOriginLoading);
    const isUniversalTransaction =
        transaction.transaction_types.includes('universal_tx') ||
        !!counterpartyOrigin?.isUEA ||
        !!targetOrigin?.isUEA;
    const counterpartyAddress =
        getUEAOriginDisplayAddress(counterpartyOrigin) ||
        displayTransfer.counterpartyAddress ||
        getUEAOriginDisplayAddress(targetOrigin) ||
        '';
    const hasResolvedUEAAddress =
        !!getUEAOriginDisplayAddress(counterpartyOrigin) ||
        (!displayTransfer.counterpartyAddress &&
            !!getUEAOriginDisplayAddress(targetOrigin));
    const counterpartyName = hasResolvedUEAAddress
        ? null
        : displayTransfer.counterpartyName;

    function getChainIcon(chainId) {
        if (chainId == null) {
            return <PushChainMonotone size={10} />
        }
        if (chainId === 'devnet') {
            return <PushChainMonotone size={10} />;
        }
        const IconComponent = CHAIN_MONOTONE_LOGO?.[chainId];
        if (IconComponent) {
            return <IconComponent size={20} color="pw-int-icon-tertiary-color" />;
        } else {
            return <DefaultChainMonotone size={20} />;
        }
    }

    return (
        <Box
            display="flex"
            justifyContent="space-between"
            padding="spacing-sm spacing-xxxs"
            css={css`
              border-bottom: var(--border-sm) solid var(--pw-int-border-secondary-color);
            `}
        >

            <Box display="flex" gap="spacing-xxs">
                <Box
                    display="flex"
                    padding="spacing-xxs"
                    alignItems="center"
                    borderRadius="radius-xs"
                    backgroundColor="pw-int-bg-primary-color"
                    border="border-sm solid pw-int-border-secondary-color"
                    width="32px"
                    height="32px"
                >
                    {displayTransfer.direction === 'out' && (
                        <ExternalLinkIcon size={16} color="pw-int-icon-brand-color" />
                    )}
                    {displayTransfer.direction === 'in' && (
                        <InternalLink size={16} color="pw-int-icon-success-bold-color" />
                    )}
                    {(displayTransfer.direction === 'contract' || displayTransfer.direction === 'unknown') && (
                        <Doc size={16} color="pw-int-icon-tertiary-color" />
                    )}
                </Box>
                <Box display="flex" flexDirection="column" gap='spacing-xxxs'>
                    {showTxType(
                        transaction.transaction_types,
                        displayTransfer.direction,
                        isUniversalTransaction,
                        isResolvingUniversalTransaction,
                    )}
                    {renderCounterparty(
                        counterpartyAddress,
                        counterpartyName,
                        getChainIcon,
                    )}
                </Box>
            </Box>
            <Box display="flex" alignItems="center">
                <Text variant="bes-regular" textAlign='right'>
                    {displayTransfer.formattedValue} {displayTransfer.symbol}
                </Text>
            </Box>

        </Box>
    );
};

export { WalletActivityListItem };

type DisplayDirection = 'in' | 'out' | 'contract' | 'unknown';

type DisplayTransfer = {
    counterpartyAddress: string;
    counterpartyName: string | null;
    direction: DisplayDirection;
    formattedValue: string;
    symbol: string;
}

const normalizeAddress = (value?: string | null) => {
    if (!value) return '';

    return convertCaipToObject(value).result.address.toLowerCase();
}

const isSameAddress = (a?: string | null, b?: string | null) =>
    !!a && !!b && normalizeAddress(a) === normalizeAddress(b);

const isTrackedWalletAddress = (
    walletAddresses: string[],
    address?: string | null,
) =>
    walletAddresses.some((walletAddress) => isSameAddress(walletAddress, address));

const getAddressHash = (addressInfo?: { hash?: string | null } | null) =>
    addressInfo?.hash ?? '';

const getTransferCounterparty = (
    transfer: WalletActivityTokenTransfer,
    direction: DisplayDirection,
): WalletActivityAddress | null | undefined => {
    if (direction === 'out') return transfer.to;
    if (direction === 'in') return transfer.from;

    return transfer.to ?? transfer.from;
}

const getUEACheckAddress = (address?: string | null) => {
    if (!address) return undefined;

    const { result } = convertCaipToObject(address);

    return /^0x[0-9a-fA-F]{40}$/.test(result.address)
        ? result.address
        : undefined;
}

const normalizeDecimals = (decimals?: string | number | null) => {
    const parsedDecimals = Number(decimals);
    return Number.isFinite(parsedDecimals) ? parsedDecimals : 18;
}

const addIntegerGrouping = (value: string) =>
    value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const formatDecimalValue = (value: string) => {
    const normalizedValue = value.trim();

    if (!normalizedValue) return '0';

    if (normalizedValue.includes('e')) {
        return Number(normalizedValue).toLocaleString(undefined, {
            maximumFractionDigits: 18,
        });
    }

    const sign = normalizedValue.startsWith('-') ? '-' : '';
    const unsignedValue = sign ? normalizedValue.slice(1) : normalizedValue;
    const [integerPart = '0', fractionPart = ''] = unsignedValue.split('.');
    const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';

    if (!fractionPart || Number(fractionPart) === 0) {
        return `${sign}${addIntegerGrouping(normalizedInteger)}`;
    }

    const firstNonZeroIndex = fractionPart.search(/[1-9]/);

    if (firstNonZeroIndex === -1) {
        return `${sign}${addIntegerGrouping(normalizedInteger)}`;
    }

    const hasWholeValue = normalizedInteger !== '0';
    const fractionDigits = hasWholeValue ? 2 : Math.max(2, firstNonZeroIndex + 2);
    const truncatedFraction = fractionPart
        .slice(0, fractionDigits)
        .replace(/0+$/, '');

    if (!truncatedFraction) {
        return `${sign}${addIntegerGrouping(normalizedInteger)}`;
    }

    return `${sign}${addIntegerGrouping(normalizedInteger)}.${truncatedFraction}`;
}

const formatRawTokenValue = (
    value?: string | number | bigint | null,
    decimals: number = 18,
) => {
    const rawValue = String(value ?? '0').trim();

    if (!rawValue) return '0';

    if (!/^\d+$/.test(rawValue)) {
        return formatDecimalValue(rawValue);
    }

    return formatDecimalValue(formatUnits(BigInt(rawValue), decimals));
}

const getTokenTransferDirection = (
    transfer: WalletActivityTokenTransfer,
    walletAddresses: string[],
): DisplayDirection => {
    if (isTrackedWalletAddress(walletAddresses, getAddressHash(transfer.from))) return 'out';
    if (isTrackedWalletAddress(walletAddresses, getAddressHash(transfer.to))) return 'in';

    return 'unknown';
}

const getTransactionDirection = (
    transaction: WalletActivitiesResponse,
    walletAddresses: string[],
): DisplayDirection => {
    if (isTrackedWalletAddress(walletAddresses, transaction.from?.hash) && transaction.to) return 'out';
    if (isTrackedWalletAddress(walletAddresses, transaction.to?.hash)) return 'in';
    if (!transaction.to && transaction.created_contract) return 'contract';

    return 'unknown';
}

const getDisplayTransfer = (
    transaction: WalletActivitiesResponse,
    walletAddresses: string[],
): DisplayTransfer => {
    const tokenTransfer = getRelevantActivityTokenTransfer(
        transaction,
        walletAddresses,
    );

    if (tokenTransfer) {
        const direction = getTokenTransferDirection(tokenTransfer, walletAddresses);
        const counterparty = getTransferCounterparty(tokenTransfer, direction);
        const decimals = normalizeDecimals(
            tokenTransfer.total?.decimals ?? tokenTransfer.token?.decimals,
        );
        const symbol = getActivityTokenDisplaySymbol(tokenTransfer);

        return {
            counterpartyAddress: getAddressHash(counterparty),
            counterpartyName: getVerifiedActivityAddressName(counterparty),
            direction,
            formattedValue: formatRawTokenValue(tokenTransfer.total?.value, decimals),
            symbol,
        };
    }

    const direction = getTransactionDirection(transaction, walletAddresses);
    const counterparty =
        direction === 'out'
            ? transaction.to ?? transaction.created_contract
            : direction === 'in'
                ? transaction.from
                : transaction.created_contract ?? transaction.to;

    return {
        counterpartyAddress: getAddressHash(counterparty),
        counterpartyName: getVerifiedActivityAddressName(counterparty),
        direction,
        formattedValue: formatRawTokenValue(transaction.value, 18),
        symbol: 'PC',
    };
}

const normalizeOriginOwner = (owner: string, chainNamespace?: string) => {
    const isEvmOrigin = chainNamespace === 'eip155' || chainNamespace === 'ethereum';

    if (isEvmOrigin && /^0x[0-9a-fA-F]{64}$/.test(owner)) {
        return `0x${owner.slice(-40)}`;
    }

    return owner;
}

const getUEAOriginDisplayAddress = (
    ueaOrigin?: {
        owner: string;
        isUEA: boolean;
        chainNamespace?: string;
        chainId?: string;
    } | null,
) => {
    if (!ueaOrigin?.isUEA) return null;

    const owner = normalizeOriginOwner(
        ueaOrigin.owner,
        ueaOrigin.chainNamespace,
    );

    if (!ueaOrigin.chainNamespace || !ueaOrigin.chainId) return owner;

    return `${ueaOrigin.chainNamespace}:${ueaOrigin.chainId}:${owner}`;
}

const renderCounterparty = (
    displayAddress: string,
    displayName: string | null,
    getChainIcon: (chainId: string | null) => ReactNode,
) => {
    if (!displayAddress) return null;

    const { result } = convertCaipToObject(displayAddress);
    const addressToShow = result.address ?? displayAddress;

    if (!addressToShow) return null;

    return (
        <Box display="flex" gap="spacing-xxs" alignItems='center'>
            <Box
                height="18px"
                width="18px"
                backgroundColor="pw-int-bg-tertiary-color"
                borderRadius="radius-xxxs"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                {getChainIcon(result.chainId)}
            </Box>

            <Text color="pw-int-text-secondary-color" variant="bes-semibold">
                {displayName || centerMaskWalletAddress(addressToShow)}
            </Text>
        </Box>
    );
}

const showTxType = (
    types: Array<TransactionType>,
    direction?: DisplayDirection,
    isUniversalTransaction?: boolean,
    isResolvingUniversalTransaction?: boolean,
) => {
    if (isUniversalTransaction) {
        return <Text variant="bm-regular">Universal Transaction</Text>;
    }

    if (isResolvingUniversalTransaction) {
        return <Text variant="bm-regular">Transaction</Text>;
    }

    const TYPES_ORDER: Array<TransactionType> = [
        'blob_transaction',
        'token_creation',
        'contract_creation',
        'token_transfer',
        'contract_call',
        'coin_transfer',
        'universal_tx'
    ];

    let label;

    const typeToShow = [...types].sort((t1, t2) => TYPES_ORDER.indexOf(t1) - TYPES_ORDER.indexOf(t2))[0];

    switch (typeToShow) {
        case 'universal_tx':
            label = 'Universal Transaction';
            break;
        case 'contract_call':
            label = 'Contract Call';
            break;
        case 'blob_transaction':
            label = 'Blob txn';
            break;
        case 'contract_creation':
            label = 'Contract Creation';
            break;
        case 'token_transfer':
            if (direction === 'out') {
                label = 'Send';
            } else if (direction === 'in') {
                label = 'Receive';
            } else {
                label = 'Token Transfer';
            }
            break;
        case 'token_creation':
            label = 'Token Creation';
            break;
        case 'coin_transfer':
            if (direction === 'out') {
                label = 'Send';
            } else if (direction === 'in') {
                label = 'Receive';
            } else {
                label = 'Coin Transfer';
            }
            break;
        default:
            label = 'Transaction';
    }

    return <Text variant="bm-regular">{label}</Text>
}

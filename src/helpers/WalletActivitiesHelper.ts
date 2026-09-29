// helpers/fetchTransactions.ts
import axios from 'axios';
import { EXPLORER_URL } from '../common/Common.constants';
import {
    ActivitiesNextPageParams,
    WalletActivitiesResponse,
    WalletActivityTokenTransfer,
} from '../types/walletactivities.types';

export interface FetchWalletActivitiesParams {
    address: string;
    pageParam?: ActivitiesNextPageParams;
    page?: number;
    limit?: number;
    filter?: string;
}

export interface ApiResponse {
    items: WalletActivitiesResponse[];
    next_page_params?: ActivitiesNextPageParams;
}

type TokenTransfersResponse = {
    items?: WalletActivityTokenTransfer[];
}

type TransactionLog = {
    topics?: Array<string | null>;
}

type TransactionLogsResponse = {
    items?: TransactionLog[];
}

const UNISWAP_V3_SWAP_TOPIC =
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const SWAP_EVENT_CACHE_LIMIT = 250;
const SWAP_EVENT_MISS_TTL_MS = 45_000;
type SwapEventCacheEntry = {
    hasSwapEvent: boolean;
    cachedAt: number;
}
const swapEventCache = new Map<string, SwapEventCacheEntry>();
const swapEventInflight = new Map<string, Promise<boolean | undefined>>();

const isZeroValue = (value: WalletActivitiesResponse['value']) => {
    const normalizedValue = String(value ?? '0').trim();
    return !normalizedValue || normalizedValue === '0';
};

const shouldFetchTokenTransfers = (transaction: WalletActivitiesResponse) =>
    !transaction.token_transfers?.length &&
    (
        isZeroValue(transaction.value) ||
        transaction.transaction_types.includes('token_transfer') ||
        transaction.transaction_types.includes('universal_tx')
    );

const isSuccessfulTransaction = (transaction: WalletActivitiesResponse) => {
    const status = transaction.status.trim().toLowerCase();
    return status === 'ok' || status === 'success';
};

const shouldFetchSwapEvent = (transaction: WalletActivitiesResponse) =>
    typeof transaction.has_swap_event !== 'boolean' &&
    isSuccessfulTransaction(transaction) &&
    (
        transaction.transaction_types.includes('contract_call') ||
        transaction.transaction_types.includes('universal_tx')
    );

const setBoundedSwapEventCache = (hash: string, hasSwapEvent: boolean) => {
    if (swapEventCache.has(hash)) {
        swapEventCache.delete(hash);
    }
    swapEventCache.set(hash, {
        hasSwapEvent,
        cachedAt: Date.now(),
    });

    while (swapEventCache.size > SWAP_EVENT_CACHE_LIMIT) {
        const oldestHash = swapEventCache.keys().next().value;
        if (oldestHash === undefined) break;
        swapEventCache.delete(oldestHash);
    }
};

const fetchTransactionTokenTransfers = async (hash: string) => {
    try {
        const response = await axios.get<TokenTransfersResponse>(
            `${EXPLORER_URL}/api/v2/transactions/${hash}/token-transfers`,
            {
                headers: {
                    accept: 'application/json',
                },
            },
        );

        return response.data.items ?? [];
    } catch (error) {
        console.debug('Unable to fetch transaction token transfers', hash, error);
        return [];
    }
};

const fetchTransactionHasSwapEvent = (
    hash: string,
): Promise<boolean | undefined> => {
    const normalizedHash = hash.trim().toLowerCase();
    if (!normalizedHash) return Promise.resolve(undefined);

    const cached = swapEventCache.get(normalizedHash);
    if (cached) {
        const isFresh =
            cached.hasSwapEvent ||
            Date.now() - cached.cachedAt < SWAP_EVENT_MISS_TTL_MS;
        if (isFresh) return Promise.resolve(cached.hasSwapEvent);
        swapEventCache.delete(normalizedHash);
    }

    const inflight = swapEventInflight.get(normalizedHash);
    if (inflight) return inflight;

    const request = (async () => {
        try {
            const response = await axios.get<TransactionLogsResponse>(
                `${EXPLORER_URL}/api/v2/transactions/${hash}/logs`,
                {
                    headers: {
                        accept: 'application/json',
                    },
                },
            );
            const hasSwapEvent = (response.data.items ?? []).some(
                (log) =>
                    log.topics?.[0]?.toLowerCase() === UNISWAP_V3_SWAP_TOPIC,
            );
            setBoundedSwapEventCache(normalizedHash, hasSwapEvent);
            return hasSwapEvent;
        } catch (error) {
            console.debug('Unable to fetch transaction logs', hash, error);
            return undefined;
        } finally {
            swapEventInflight.delete(normalizedHash);
        }
    })();

    swapEventInflight.set(normalizedHash, request);
    return request;
};

const enrichWalletActivities = async (items: WalletActivitiesResponse[]) => {
    const enrichedItems = await Promise.all(
        items.map(async (transaction) => {
            const [tokenTransfers, hasSwapEvent] = await Promise.all([
                shouldFetchTokenTransfers(transaction)
                    ? fetchTransactionTokenTransfers(transaction.hash)
                    : Promise.resolve(undefined),
                shouldFetchSwapEvent(transaction)
                    ? fetchTransactionHasSwapEvent(transaction.hash)
                    : Promise.resolve(undefined),
            ]);

            if (!tokenTransfers?.length && hasSwapEvent === undefined) {
                return transaction;
            }

            return {
                ...transaction,
                ...(tokenTransfers?.length
                    ? { token_transfers: tokenTransfers }
                    : {}),
                ...(hasSwapEvent !== undefined
                    ? { has_swap_event: hasSwapEvent }
                    : {}),
            };
        }),
    );

    return enrichedItems;
};

export const fetchWalletActivities = async ({
    address,
    pageParam,
    filter = 'to | from',
}: FetchWalletActivitiesParams): Promise<ApiResponse> => {
    const url = `${EXPLORER_URL}/api/v2/addresses/${address}/transactions`;

    // Build query parameters
    const params: Record<string, string> = {};

    if (filter) {
        params.filter = filter;
    }

    if (pageParam) {
        params.block_number = pageParam.block_number.toString();
        params.fee = pageParam.fee;
        params.hash = pageParam.hash;
        params.index = pageParam.index.toString();
        params.inserted_at = pageParam.inserted_at;
        params.items_count = pageParam.items_count.toString();
        params.value = pageParam.value;
    }

    const response = await axios.get<ApiResponse>(url, {
        params,
        headers: {
            accept: 'application/json',
        },
    });

    return {
        ...response.data,
        items: await enrichWalletActivities(response.data.items ?? []),
    };
};

// helpers/fetchTransactions.ts
import axios from 'axios';
import { EXPLORER_URL } from 'common';
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

const enrichWalletActivities = async (items: WalletActivitiesResponse[]) => {
    const enrichedItems = await Promise.all(
        items.map(async (transaction) => {
            if (!shouldFetchTokenTransfers(transaction)) return transaction;

            const tokenTransfers = await fetchTransactionTokenTransfers(transaction.hash);

            if (!tokenTransfers.length) return transaction;

            return {
                ...transaction,
                token_transfers: tokenTransfers,
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

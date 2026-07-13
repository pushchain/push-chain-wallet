import { TransactionType } from "../modules/wallet/Wallet.types";

export type WalletActivityAddress = {
    hash: string;
    name?: string;
}

export type WalletActivityTokenTransfer = {
    from?: WalletActivityAddress | null;
    to?: WalletActivityAddress | null;
    token?: {
        address?: string;
        decimals?: string | number | null;
        name?: string | null;
        symbol?: string | null;
        type?: string | null;
    } | null;
    total?: {
        decimals?: string | number | null;
        value?: string | number | bigint | null;
    } | null;
    type?: string;
}

export type WalletActivitiesResponse = {
    hash: string;
    value: string | number | bigint;
    from: WalletActivityAddress;
    to: WalletActivityAddress | null;
    created_contract: WalletActivityAddress | null;
    token_transfers?: WalletActivityTokenTransfer[];
    timestamp: string;
    gas_used: string;
    fee: {
        value: string;
    };
    status: string;
    transaction_types: Array<TransactionType>;
    block_number: number;
}

export type ActivitiesNextPageParams = {
    block_number: number;
    fee: string;
    hash: string;
    index: number;
    inserted_at: string;
    items_count: number;
    value: string;
}

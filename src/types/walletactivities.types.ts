import { TransactionType } from "../modules/wallet/Wallet.types";

export type WalletActivityAddress = {
    hash: string;
    name?: string | null;
    /**
     * Explorer verification is required before an address name is presented
     * as contract metadata. Unverified names must never replace an address.
     */
    is_verified?: boolean;
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
    /**
     * Set after checking the immutable transaction receipt logs for the
     * canonical Uniswap V3 Swap event. Universal transactions alone are not
     * sufficient evidence that an activity is a swap.
     */
    has_swap_event?: boolean;
    timestamp: string;
    gas_used: string;
    /**
     * Push Chain charges the UEA through the Cosmos fee module even when the
     * relayed EVM envelope reports a zero gas price. Together with gas_used,
     * this recovers the fee that was actually deducted from the UEA.
     */
    base_fee_per_gas?: string | number | bigint | null;
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

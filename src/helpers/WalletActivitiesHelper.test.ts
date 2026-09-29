import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletActivitiesResponse } from '../types/walletactivities.types';

const { axiosGetMock } = vi.hoisted(() => ({
    axiosGetMock: vi.fn(),
}));

vi.mock('axios', () => ({
    default: {
        get: axiosGetMock,
    },
}));

vi.mock('../common/Common.constants', () => ({
    EXPLORER_URL: 'https://explorer.test',
}));

import { fetchWalletActivities } from './WalletActivitiesHelper';

const SWAP_TOPIC =
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

const transaction = (
    hash: string,
    overrides: Partial<WalletActivitiesResponse> = {},
): WalletActivitiesResponse => ({
    hash,
    value: '0',
    from: { hash: '0x1111111111111111111111111111111111111111' },
    to: { hash: '0x2222222222222222222222222222222222222222' },
    created_contract: null,
    timestamp: '2026-07-30T07:19:52.000000Z',
    gas_used: '100000',
    fee: { value: '0' },
    status: 'ok',
    transaction_types: ['contract_call', 'token_transfer'],
    block_number: 1,
    ...overrides,
});

const tokenTransfer = {
    from: { hash: '0x3333333333333333333333333333333333333333' },
    to: { hash: '0x2222222222222222222222222222222222222222' },
    token: {
        address: '0x4444444444444444444444444444444444444444',
        decimals: '18',
        name: 'Wrapped PC',
        symbol: 'WPC',
        type: 'ERC-20',
    },
    total: {
        decimals: '18',
        value: '18225380654551171160',
    },
    type: 'token_transfer',
};

const mockActivityRequests = ({
    item,
    topics = [],
    failLogs = false,
}: {
    item: WalletActivitiesResponse;
    topics?: Array<string | null>;
    failLogs?: boolean;
}) => {
    axiosGetMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/token-transfers')) {
            return { data: { items: [tokenTransfer] } };
        }
        if (url.endsWith('/logs')) {
            if (failLogs) throw new Error('Explorer unavailable');
            return { data: { items: [{ topics }] } };
        }
        return {
            data: {
                items: [item],
                next_page_params: null,
            },
        };
    });
};

describe('wallet activity swap-event enrichment', () => {
    beforeEach(() => {
        axiosGetMock.mockReset();
        vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('annotates a successful contract transaction from the canonical Swap event while preserving token transfers', async () => {
        const item = transaction(`0x${'1'.repeat(64)}`);
        mockActivityRequests({
            item,
            topics: [SWAP_TOPIC.toUpperCase()],
        });

        const result = await fetchWalletActivities({ address: item.to!.hash });

        expect(result.items[0]).toMatchObject({
            hash: item.hash,
            has_swap_event: true,
            token_transfers: [tokenTransfer],
        });
        expect(axiosGetMock).toHaveBeenCalledWith(
            `https://explorer.test/api/v2/transactions/${item.hash}/logs`,
            {
                headers: {
                    accept: 'application/json',
                },
            },
        );
    });

    it('requires the canonical event to be the first log topic', async () => {
        const item = transaction(`0x${'2'.repeat(64)}`, {
            token_transfers: [tokenTransfer],
        });
        mockActivityRequests({
            item,
            topics: [`0x${'a'.repeat(64)}`, SWAP_TOPIC],
        });

        const result = await fetchWalletActivities({ address: item.to!.hash });

        expect(result.items[0].has_swap_event).toBe(false);
    });

    it('deduplicates inflight log requests and reuses the immutable bounded cache', async () => {
        const item = transaction(`0x${'3'.repeat(64)}`, {
            token_transfers: [tokenTransfer],
        });
        mockActivityRequests({
            item,
            topics: [SWAP_TOPIC],
        });

        const [first, second] = await Promise.all([
            fetchWalletActivities({ address: item.to!.hash }),
            fetchWalletActivities({ address: item.to!.hash }),
        ]);
        const third = await fetchWalletActivities({ address: item.to!.hash });
        const logCalls = axiosGetMock.mock.calls.filter(([url]) =>
            String(url).endsWith('/logs'),
        );

        expect(first.items[0].has_swap_event).toBe(true);
        expect(second.items[0].has_swap_event).toBe(true);
        expect(third.items[0].has_swap_event).toBe(true);
        expect(logCalls).toHaveLength(1);
    });

    it('does not inspect failed or non-contract transactions', async () => {
        const failed = transaction(`0x${'4'.repeat(64)}`, {
            status: 'error',
            transaction_types: ['contract_call', 'token_transfer'],
            token_transfers: [tokenTransfer],
        });
        const transfer = transaction(`0x${'5'.repeat(64)}`, {
            transaction_types: ['token_transfer'],
            token_transfers: [tokenTransfer],
        });
        axiosGetMock.mockResolvedValue({
            data: {
                items: [failed, transfer],
                next_page_params: null,
            },
        });

        const result = await fetchWalletActivities({
            address: failed.to!.hash,
        });

        expect(result.items).toEqual([failed, transfer]);
        expect(
            axiosGetMock.mock.calls.some(([url]) =>
                String(url).endsWith('/logs'),
            ),
        ).toBe(false);
    });

    it('does not cache explorer failures so a later refresh can recover', async () => {
        const item = transaction(`0x${'6'.repeat(64)}`, {
            token_transfers: [tokenTransfer],
        });
        let logAttempts = 0;
        axiosGetMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/logs')) {
                logAttempts += 1;
                if (logAttempts === 1) throw new Error('Temporary failure');
                return { data: { items: [{ topics: [SWAP_TOPIC] }] } };
            }
            return {
                data: {
                    items: [item],
                    next_page_params: null,
                },
            };
        });

        const first = await fetchWalletActivities({ address: item.to!.hash });
        const second = await fetchWalletActivities({ address: item.to!.hash });

        expect(first.items[0].has_swap_event).toBeUndefined();
        expect(second.items[0].has_swap_event).toBe(true);
        expect(logAttempts).toBe(2);
    });

    it('expires negative results so delayed explorer indexing can be detected', async () => {
        const item = transaction(`0x${'7'.repeat(64)}`, {
            token_transfers: [tokenTransfer],
        });
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        let logAttempts = 0;
        axiosGetMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/logs')) {
                logAttempts += 1;
                return {
                    data: {
                        items:
                            logAttempts === 1
                                ? []
                                : [{ topics: [SWAP_TOPIC] }],
                    },
                };
            }
            return {
                data: {
                    items: [item],
                    next_page_params: null,
                },
            };
        });

        const first = await fetchWalletActivities({ address: item.to!.hash });
        now.mockReturnValue(1_044_999);
        const cached = await fetchWalletActivities({ address: item.to!.hash });
        now.mockReturnValue(1_045_001);
        const refreshed = await fetchWalletActivities({
            address: item.to!.hash,
        });
        now.mockReturnValue(2_000_000);
        const immutableHit = await fetchWalletActivities({
            address: item.to!.hash,
        });

        expect(first.items[0].has_swap_event).toBe(false);
        expect(cached.items[0].has_swap_event).toBe(false);
        expect(refreshed.items[0].has_swap_event).toBe(true);
        expect(immutableHit.items[0].has_swap_event).toBe(true);
        expect(logAttempts).toBe(2);
    });
});

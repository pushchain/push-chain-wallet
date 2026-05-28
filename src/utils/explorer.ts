import { CHAIN } from '@pushchain/core/src/lib/constants/enums';

const PUSH_EXPLORER_URL = 'https://donut.push.network';

const EXPLORER_URL_BY_CHAIN: Record<string, string> = {
    [CHAIN.PUSH_TESTNET_DONUT.toLowerCase()]: PUSH_EXPLORER_URL,
    '42101': PUSH_EXPLORER_URL,

    [CHAIN.ETHEREUM_SEPOLIA.toLowerCase()]: 'https://sepolia.etherscan.io',
    '11155111': 'https://sepolia.etherscan.io',

    [CHAIN.ARBITRUM_SEPOLIA.toLowerCase()]: 'https://sepolia.arbiscan.io',
    '421614': 'https://sepolia.arbiscan.io',

    [CHAIN.BASE_SEPOLIA.toLowerCase()]: 'https://sepolia.basescan.org',
    '84532': 'https://sepolia.basescan.org',

    [CHAIN.BNB_TESTNET.toLowerCase()]: 'https://testnet.bscscan.com',
    '97': 'https://testnet.bscscan.com',

    [CHAIN.SOLANA_DEVNET.toLowerCase()]: 'https://explorer.solana.com',
    etwtrabzayq6imfeykouru166vu2xqa1: 'https://explorer.solana.com',
};

const SOLANA_CLUSTER_BY_CHAIN: Record<string, string> = {
    [CHAIN.SOLANA_DEVNET.toLowerCase()]: 'devnet',
    etwtrabzayq6imfeykouru166vu2xqa1: 'devnet',
};

const getExplorerLookupKeys = (chain: string | number | null | undefined) => {
    const rawChain = String(chain ?? '').trim().toLowerCase();
    const caipChainId = rawChain.split(':')[1];

    return caipChainId ? [rawChain, caipChainId] : [rawChain];
};

export const getAddressExplorerUrl = (
    chain: CHAIN | string | number | null | undefined,
    address: string,
) => {
    const lookupKey = getExplorerLookupKeys(chain).find(
        (key) => EXPLORER_URL_BY_CHAIN[key],
    );
    const explorerUrl = lookupKey
        ? EXPLORER_URL_BY_CHAIN[lookupKey]
        : PUSH_EXPLORER_URL;
    const cluster = lookupKey ? SOLANA_CLUSTER_BY_CHAIN[lookupKey] : '';
    const clusterQuery = cluster ? `?cluster=${cluster}` : '';

    return `${explorerUrl}/address/${address}${clusterQuery}`;
};

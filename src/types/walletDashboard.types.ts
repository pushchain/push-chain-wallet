
export type ActiveStates = 'walletDashboard' | 'send' | 'receive' | 'addTokens' | 'recoveryPhrase'
export type PushNetworks = 'Push Testnet Donut' | 'Push Testnet Sushi';

export type TokenFormat = {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    balance?: string;
    rawBalance?: string;
}

export type WalletListType = {
    name: string;
    address: string;
    fullAddress: string;
    isSelected: boolean;
    type: string;
};


export type UniversalAddress = {
    chainId: string | null;
    chain: string | null;
    address: string | null;
}

export type SendTokenState = 'selectToken' | 'selectRecipient' | 'review' | 'confirmation'

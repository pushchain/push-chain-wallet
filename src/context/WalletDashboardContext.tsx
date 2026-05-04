import { createContext, useContext, ReactNode } from 'react';
import { ActiveStates, PushNetworks, TokenFormat, WalletListType } from '../types';

interface WalletDashboardContextType {
    selectedWallet: WalletListType | undefined;
    setSelectedWallet: (wallet: WalletListType) => void;
    showConnectionSuccess: boolean;
    setConnectionSuccess: (show: boolean) => void;
    activeState: ActiveStates;
    setActiveState: (state: ActiveStates) => void;
    startSendFlow: (token?: TokenFormat | null) => void;
    selectedNetwork: PushNetworks;
    setSelectedNetwork: (network: PushNetworks) => void;
}

const WalletDashboardContext = createContext<WalletDashboardContextType | undefined>(undefined);

interface WalletProviderProps {
    children: ReactNode;
    selectedWallet: WalletListType | undefined;
    setSelectedWallet: (wallet: WalletListType) => void;
    showConnectionSuccess: boolean;
    setConnectionSuccess: (show: boolean) => void;
    activeState: ActiveStates;
    setActiveState: (state: ActiveStates) => void;
    startSendFlow: (token?: TokenFormat | null) => void;
    selectedNetwork: PushNetworks;
    setSelectedNetwork: (network: PushNetworks) => void;
}

export const WalletDashboardProvider = ({
    children,
    selectedWallet,
    setSelectedWallet,
    showConnectionSuccess,
    setConnectionSuccess,
    activeState,
    setActiveState,
    startSendFlow,
    selectedNetwork,
    setSelectedNetwork,
}: WalletProviderProps) => {

    return (
        <WalletDashboardContext.Provider
            value={{
                selectedWallet,
                setSelectedWallet,
                showConnectionSuccess,
                setConnectionSuccess,
                activeState,
                setActiveState,
                startSendFlow,
                selectedNetwork,
                setSelectedNetwork,
            }}
        >
            {children}
        </WalletDashboardContext.Provider>
    );
};

export const useWalletDashboard = () => {
    const context = useContext(WalletDashboardContext);
    if (context === undefined) {
        throw new Error('useWalletDashboard must be used within a WalletProvider');
    }
    return context;
}; 
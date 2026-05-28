import { createContext, useContext, ReactNode } from 'react';
import { ActiveStates, PushNetworks, WalletListType } from '../types';
import { TokenDetails } from './SendTokenContext';

interface WalletDashboardContextType {
    selectedWallet: WalletListType | undefined;
    setSelectedWallet: (wallet: WalletListType) => void;
    showConnectionSuccess: boolean;
    setConnectionSuccess: (show: boolean) => void;
    activeState: ActiveStates;
    setActiveState: (state: ActiveStates) => void;
    startSendFlow: (tokenDetails?: TokenDetails) => void;
    selectedNetwork: PushNetworks;
    setSelectedNetwork: (network: PushNetworks) => void;
}

const WalletDashboardContext = createContext<WalletDashboardContextType | undefined>(undefined);

interface WalletProviderProps extends WalletDashboardContextType {
    children: ReactNode;
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
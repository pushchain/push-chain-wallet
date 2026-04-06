import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PushChain } from '@pushchain/core';
import { useGlobalState } from './GlobalContext';
import { useExternalWallet } from './ExternalWalletContext';
import { PUSH_NETWORK } from '@pushchain/core/src/lib/constants/enums';
import { getWalletlist } from '../modules/wallet/Wallet.utils';
import { createGuardedPushChain, checkAndShowUpgradeIfNeeded } from '../helpers/txnAuthGuard';
import { useEventEmitterContext } from './EventEmitterContext';
import { getAppParamValue } from '../common';

type PushChainContextType = {
    pushChainClient: PushChain | null;
    executorAddress: string | null;
    error: Error | null;
    isLoading: boolean;
    reinitialize: () => void;
};

const PushChainContext = createContext<PushChainContextType | null>(null);

export const usePushChain = (): PushChainContextType => {
    const context = useContext(PushChainContext);
    if (!context) {
        throw new Error('usePushChain must be used within PushChainProvider');
    }
    return context;
};

interface PushChainProviderProps {
    children: ReactNode;
}

export const PushChainProvider: React.FC<PushChainProviderProps> = ({ children }) => {
    const { dispatch, state } = useGlobalState();
    const {
        signMessageRequest,
        signTransactionRequest,
        signTypedDataRequest,
    } = useExternalWallet();
    const { handleReconnectWallet, handleReconnectExternalWallet } = useEventEmitterContext();

    const [pushChainClient, setPushChainClient] = useState<PushChain | null>(null);
    const [executorAddress, setExecutorAddress] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isOpenedInIframe = !!getAppParamValue();

    const pushWallet = getWalletlist(state.wallet)[0];
    const readOnlyWallet = state.pushWallet ? PushChain.utils.account.toChainAgnostic(state.pushWallet.address, { chain: state.pushWallet.chain }) : null;
    const parsedWallet = pushWallet?.fullAddress || readOnlyWallet || state?.externalWallet?.originAddress;

    const initializePushChain = async () => {
        if (!parsedWallet) {
            setPushChainClient(null);
            setExecutorAddress(null);
            dispatch({ type: "SET_UPGRADE_CHECKED", payload: false });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const universalAccount = PushChain.utils.account.fromChainAgnostic(parsedWallet);
            const CHAINS = PushChain.CONSTANTS.CHAIN;
            const isSolana = [
                CHAINS.SOLANA_DEVNET,
                CHAINS.SOLANA_MAINNET,
                CHAINS.SOLANA_TESTNET,
            ].includes(universalAccount.chain);

            const signerSkeleton = PushChain.utils.signer.construct(
                universalAccount,
                {
                    signMessage: state.wallet ? state.wallet.universalSigner.signMessage : signMessageRequest,
                    signAndSendTransaction: state.wallet ? state.wallet.universalSigner.signAndSendTransaction : signTransactionRequest,
                    signTypedData: isSolana ? undefined : state.wallet ? state.wallet.universalSigner.signTypedData : signTypedDataRequest,
                }
            );

            const universalSigner = await PushChain.utils.signer.toUniversal(signerSkeleton);

            const initializeProps = {
                network: PUSH_NETWORK.TESTNET_DONUT,
                progressHook: async (progress: any) => {
                    console.log("Progress hook", progress);
                },
            };

            let pushChain: PushChain;

            if (state.isReadOnly) {
                pushChain = await PushChain.initialize(universalAccount, {
                    network: PUSH_NETWORK.TESTNET_DONUT,
                });
            } else {
                pushChain = await PushChain.initialize(universalSigner, initializeProps);
            }

            const guardedPushChainClient = createGuardedPushChain(
                pushChain,
                handleReconnectExternalWallet,
                handleReconnectWallet,
                universalSigner,
                initializeProps,
                () => {
                    dispatch({ type: "SET_READ_ONLY", payload: false });
                },
                dispatch,
            );

            setPushChainClient(guardedPushChainClient);
            setExecutorAddress(guardedPushChainClient.universal.account);

            if (!state.upgradeChecked && !isOpenedInIframe) {
                await checkAndShowUpgradeIfNeeded(guardedPushChainClient, dispatch);
                dispatch({ type: "SET_UPGRADE_CHECKED", payload: true });
            }

        } catch (err) {
            console.error('Error occurred when initializing PushChain:', err);
            setError(err instanceof Error ? err : new Error('Failed to initialize PushChain'));
            setPushChainClient(null);
            setExecutorAddress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const reinitialize = () => {
        initializePushChain();
    };

    useEffect(() => {
        initializePushChain();
    }, [parsedWallet, state.upgradeChecked]);

    const value: PushChainContextType = {
        pushChainClient,
        executorAddress,
        error,
        isLoading,
        reinitialize,
    };

    return (
        <PushChainContext.Provider value={value}>
            {children}
        </PushChainContext.Provider>
    );
};

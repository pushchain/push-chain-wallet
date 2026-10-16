import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { PushChain } from '@pushchain/core';
import { useGlobalState } from './GlobalContext';
import { useExternalWallet } from './ExternalWalletContext';
import { PUSH_NETWORK } from '@pushchain/core/src/lib/constants/enums';
import { getWalletlist } from '../modules/wallet/Wallet.utils';
import { createGuardedPushChain, checkAndShowUpgradeIfNeeded } from '../helpers/txnAuthGuard';
import { useEventEmitterContext } from './EventEmitterContext';
import { getAppParamValue } from '../common';
import type { ProgressEvent } from "@pushchain/core/src/lib/progress-hook/progress-hook.types";
import { progressStore } from "../common/progress/progressStore";

type PushChainContextType = {
    pushChainClient: PushChain | null;
    executorAddress: string | null;
    error: Error | null;
    isLoading: boolean;
    reinitialize: () => void;
    /*
     * A client acting as one of the owner's agentic wallets (owner door): the normal SDK
     * flows then read and act for that wallet, e.g. its tokens and sub-accounts.
     */
    createAgenticClient: (wallet: `0x${string}`) => Promise<PushChain>;
    /* An agentic wallet client already created, for rendering without a loading step */
    peekAgenticClient: (wallet: `0x${string}`) => PushChain | undefined;
    /* Set inside PushChainScope for an agentic wallet: screens hide the signer's own origin-chain funds */
    agenticWallet?: `0x${string}` | null;
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
        signAuthorizationRequest,
        canSignAuthorization,
    } = useExternalWallet();
    const { handleReconnectWallet, handleReconnectExternalWallet } = useEventEmitterContext();

    const [pushChainClient, setPushChainClient] = useState<PushChain | null>(null);
    const [executorAddress, setExecutorAddress] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    /* What the current client was initialized with, reused for agentic wallet clients */
    /* Agentic wallet clients by wallet, made once and reused until the main client is re-created */
    const agenticClients = useRef(new Map<string, Promise<PushChain>>());
    const readyAgenticClients = useRef(new Map<string, PushChain>());
    const initArgs = useRef<{ signer: Parameters<typeof PushChain.initialize>[0]; options: Parameters<typeof PushChain.initialize>[1] } | null>(null);

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
                    signAuthorization: isSolana
                        ? undefined
                        : state.wallet
                            ? state.wallet.universalSigner.signAuthorization
                            : canSignAuthorization
                                ? signAuthorizationRequest
                                : undefined,
                }
            );

            const universalSigner = await PushChain.utils.signer.toUniversal(signerSkeleton);

            const initializeProps = {
                network: PUSH_NETWORK.TESTNET_DONUT,
                progressHook: async (progress: ProgressEvent) => {
                    console.log("Progress hook", progress);
                    // Shown as the bottom-right progress toast (ProgressToast)
                    progressStore.set({ event: progress, originChain: universalSigner.account.chain });
                },
            };

            let pushChain: PushChain;

            if (state.isReadOnly) {
                pushChain = await PushChain.initialize(universalAccount, {
                    network: PUSH_NETWORK.TESTNET_DONUT,
                });
                initArgs.current = { signer: universalAccount, options: { network: PUSH_NETWORK.TESTNET_DONUT } };
                agenticClients.current.clear();
                readyAgenticClients.current.clear();
            } else {
                pushChain = await PushChain.initialize(universalSigner, initializeProps);
                initArgs.current = { signer: universalSigner, options: initializeProps };
                agenticClients.current.clear();
                readyAgenticClients.current.clear();
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

    const createAgenticClient = (wallet: `0x${string}`) => {
        if (!initArgs.current) return Promise.reject(new Error('Push Chain client is not ready yet.'));
        const key = wallet.toLowerCase();
        let pending = agenticClients.current.get(key);
        if (!pending) {
            const { signer, options } = initArgs.current;
            pending = PushChain.initialize(signer, { ...options, agenticWallet: wallet }).then((client) => {
                readyAgenticClients.current.set(key, client);
                return client;
            });
            // A failed attempt is not cached, so the next visit retries.
            pending.catch(() => agenticClients.current.delete(key));
            agenticClients.current.set(key, pending);
        }
        return pending;
    };

    const peekAgenticClient = (wallet: `0x${string}`) => readyAgenticClients.current.get(wallet.toLowerCase());

    const value: PushChainContextType = {
        pushChainClient,
        executorAddress,
        error,
        isLoading,
        reinitialize,
        createAgenticClient,
        peekAgenticClient,
    };

    return (
        <PushChainContext.Provider value={value}>
            {children}
        </PushChainContext.Provider>
    );
};

/*
 * Seen through an agentic wallet scope, the client's origin is the wallet on Push Chain.
 * The SDK keeps the signer as origin (it signs and pays), but screens that list or spend
 * "origin" funds (send token picker, swap sources and balances) would otherwise offer the
 * owner's own wallet. With this view, external chains resolve to the agentic wallet's
 * sub-accounts instead. Only what the UI reads changes; calls go to the real client.
 */
const withAgenticOrigin = (client: PushChain, wallet: `0x${string}`): PushChain => {
    const origin = { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET_DONUT, address: wallet };
    const universal = new Proxy(client.universal, {
        get(target, prop) {
            if (prop === 'origin') return origin;
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
    return new Proxy(client, {
        get(target, prop) {
            if (prop === 'universal') return universal;
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
};

/*
 * Scopes the normal wallet components (tokens, sub-accounts, send, swap) to another client,
 * e.g. an agentic wallet's: usePushChain() below returns that client and its account.
 */
export const PushChainScope: React.FC<{ client: PushChain; agenticWallet?: `0x${string}`; children: ReactNode }> = ({
    client,
    agenticWallet,
    children,
}) => {
    const parent = usePushChain();
    const scoped = React.useMemo(
        () => (agenticWallet ? withAgenticOrigin(client, agenticWallet) : client),
        [client, agenticWallet],
    );
    return (
        <PushChainContext.Provider
            value={{
                ...parent,
                pushChainClient: scoped,
                executorAddress: client.universal.account,
                agenticWallet: agenticWallet ?? null,
            }}
        >
            {children}
        </PushChainContext.Provider>
    );
};

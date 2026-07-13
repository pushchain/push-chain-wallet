import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalState } from "./GlobalContext";
import {
  acceptPushWalletConnectionRequest,
  WALLET_TO_WALLET_ACTION,
  APP_TO_WALLET_ACTION,
  getAppParamValue,
  rejectAllPushWalletConnectionRequests,
  rejectPushWalletConnectionRequest,
  usePersistedQuery,
  WALLET_TO_APP_ACTION,
  useDarkMode,
  isUIKitVersion,
} from "../common";
import { requestToConnectPushWallet } from "../common";
import { APP_ROUTES } from "../constants";
import { AppMetadata, ChainType, CONSTANTS, ExternalWalletType, ITypedData, IWalletProvider, LoginMethodConfig, UniversalAccount, WalletConfig, WalletEventRespoonse } from "../types/wallet.types";
import { useAppState } from "./AppContext";
import { getOTPEmailAuthRoute, getPushSocialAuthRoute } from "../modules/Authentication/Authentication.utils";
import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import { useExternalWallet } from "./ExternalWalletContext";
import { walletRegistry } from "../providers/WalletProviderRegistry";
import { useWaapAuth } from "../waap/useWaapAuth";
import { TypedData, TypedDataDomain } from "viem";
import type { SignAuthorizationParams, SignedAuthorization } from '@pushchain/core';
import { EIP7702_UNSUPPORTED_ERROR } from '../services/pushWallet/eip7702';
import { bridgeError, SigningRequestRegistry } from '../common/signingBridge';
import {
  consumePhantomMobileConnectRequest,
  isPhantomMobileHandoffEnabled,
  PHANTOM_PROVIDER_NAME,
} from "../providers/solana/phantomMobile";

// Define the shape of the app state
export type EventEmitterState = {
  handleUserLoggedIn: () => void;
  handleLogOutEvent: () => void;
  handleAppConnectionSuccess: (origin: string) => void;
  handleAppConnectionRejected: (origin: string) => void;
  handleRejectAllAppConnections: () => void;
  handleRetryAppConnection: () => void;
  sendMessageToMainTab: (data: unknown) => void;
  txhash: string | null;
  setTxhash: React.Dispatch<React.SetStateAction<string>>;
  handleReconnectWallet: () => void;
  handleReconnectExternalWallet: (walletData: ExternalWalletType) => Promise<void>;
  handleCancelAppConnection: () => void;
  socialConnectionLoading: boolean;
  setSocialConnectionLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

// Create context
const WalletContext = createContext<EventEmitterState>({
  handleUserLoggedIn: () => { },
  handleLogOutEvent: () => { },
  handleAppConnectionSuccess: () => { },
  handleAppConnectionRejected: () => { },
  handleRejectAllAppConnections: () => { },
  handleRetryAppConnection: () => { },
  sendMessageToMainTab: () => { },
  txhash: null,
  setTxhash: () => { },
  handleReconnectWallet: () => { },
  handleReconnectExternalWallet: async () => { },
  handleCancelAppConnection: () => { },
  socialConnectionLoading: false,
  setSocialConnectionLoading: () => { },
});

// Custom hook to use the WalletContext
export function useEventEmitterContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletState must be used within a WalletProvider");
  }
  return context;
}

// Provider component to wrap around your app
export const EventEmitterProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { dispatch, state } = useGlobalState();
  const { dispatch: appDispatch } = useAppState();
  const { enable, disable } = useDarkMode();

  const [isLoggedEmitterCalled, setLoginEmitterStatus] = useState(false);
  const [txhash, setTxhash] = useState<string | null>(null);
  const [socialConnectionLoading, setSocialConnectionLoading] = useState(false);

  const navigate = useNavigate();

  const persistQuery = usePersistedQuery();

  const { connect, setExternalWallet } = useExternalWallet();

  const { logoutWaap } = useWaapAuth();

  // TODO: Right now we check the logged in wallet type. But we need to support the functionality of selected wallet type of the app.

  // For social login and email
  const walletRef = useRef(state.wallet);
  walletRef.current = state.wallet;

  const signingRequestsRef = useRef(new SigningRequestRegistry());

  useEffect(() => {
    if (walletRef.current && !isLoggedEmitterCalled) {
      setLoginEmitterStatus(true);
      handleUserLoggedIn();
    }
  }, [walletRef.current]);

  useEffect(() => {
    if (!isPhantomMobileHandoffEnabled()) return;

    const requestedChain = consumePhantomMobileConnectRequest();
    if (!requestedChain) return;

    const provider = walletRegistry.getProvider(PHANTOM_PROVIDER_NAME);
    if (!provider) return;

    let cancelled = false;

    const resumePhantomMobileConnection = async () => {
      try {
        dispatch({
          type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
          payload: "loading",
        });

        const address = await connect(provider, requestedChain);
        if (cancelled || !address) return;

        const walletPayload: ExternalWalletType = {
          originAddress: address,
          chainType: requestedChain,
          providerName: provider.name,
        };

        dispatch({
          type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
          payload: "success",
        });
        dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        dispatch({ type: "SET_EXTERNAL_WALLET", payload: walletPayload });
        setExternalWallet(walletPayload);
        navigate(`${persistQuery(APP_ROUTES.WALLET)}`, {
          replace: true,
        });
      } catch (error) {
        console.log("Failed to resume Phantom mobile connection", error);
        dispatch({
          type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
          payload: "rejected",
        });
      }
    };

    resumePhantomMobileConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  
  // useEffect(() => {
  //   const walletInfo = localStorage.getItem("walletInfo");
  //   const walletData = walletInfo ? JSON.parse(walletInfo) : null;
  //   if (!walletData) return;
  //   dispatch({ type: "SET_READ_ONLY", payload: true });
  //   setTimeout(() => {
  //     if (walletData.providerName) {
  //       handleExternalWalletConnection({
  //         status: "successful",
  //         address: walletData.originAddress,
  //         providerName: walletData.providerName,
  //         chainType: walletData.chainType,
  //       })
  //     } else {
  //       handlePushWalletConnection({
  //         status: "successful",
  //         address: walletData.address,
  //         chain: walletData.chain,
  //       })
  //     }
  //   }, 0);
  // }, []);

  // Event listener for messages
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (
        event.origin === getAppParamValue() ||
        event.origin === window.location.origin
      ) {
        switch (event.data.type) {
          case APP_TO_WALLET_ACTION.NEW_CONNECTION_REQUEST:
            handleNewConnectionRequest(event.origin);
            break;
          case APP_TO_WALLET_ACTION.WALLET_CONFIG:
            handleWalletConfigs(event.data.data);
            break;
          case APP_TO_WALLET_ACTION.SIGN_MESSAGE:
            if (isUIKitVersion('6')) {
              signingRequestsRef.current.resolve(event.data);
            } else {
              handleSignAndSendMessage(event.data.data, event.data.requestId);
            }
            break;
          case APP_TO_WALLET_ACTION.SIGN_TRANSACTION:
            if (isUIKitVersion('6')) {
              signingRequestsRef.current.resolve(event.data);
            } else {
              handleSignAndSendTransaction(event.data.data, event.data.requestId);
            }
            break;
          case APP_TO_WALLET_ACTION.SIGN_TYPED_DATA:
            if (isUIKitVersion('6')) {
              signingRequestsRef.current.resolve(event.data);
            } else {
              handleSignTypedData(event.data.data, event.data.requestId);
            }
            break;
          case APP_TO_WALLET_ACTION.SIGN_AUTHORIZATION:
            if (isUIKitVersion('6')) {
              signingRequestsRef.current.resolve(event.data);
            } else {
              handleSignAuthorization(event.data.data, event.data.requestId);
            }
            break;
          case APP_TO_WALLET_ACTION.ERROR:
            signingRequestsRef.current.reject(event.data);
            break;
          case APP_TO_WALLET_ACTION.LOG_OUT:
            handleLogOutEvent();
            break;
          case APP_TO_WALLET_ACTION.CONNECTION_STATUS:
            handleExternalWalletConnection(event.data.data);
            break;
          case APP_TO_WALLET_ACTION.SOCIAL_CONNECTION_STATUS:
            handleSocialConnection(event.data.data);
            break;
          case APP_TO_WALLET_ACTION.READ_ONLY_CONNECTION_STATUS:
            handleReadOnlyWalletConnection(event.data.data);
            break;
          case WALLET_TO_WALLET_ACTION.AUTH_STATE_PARAM:
            handleAuthStateParam(event.data.state);
            break;
          case APP_TO_WALLET_ACTION.PUSH_SEND_TRANSACTION_RESPONSE:
            if (event.data.data) {
              setTxhash(event.data.data);
            }
            break;
          case APP_TO_WALLET_ACTION.RECONNECT_WALLET:
            handleIframeReconnectWallet();
            break;
          case APP_TO_WALLET_ACTION.SHOW_UPGRADE_DRAWER:
            dispatch?.({ 
              type: "SHOW_UPGRADE_DRAWER", 
              payload: { 
                currentVersion: event.data.data.currentVersion, 
                newVersion: event.data.data.newVersion, 
              } 
            });
            break;
          default:
            console.warn("Unknown message type:", event.data);
        }
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  
  const handleIframeReconnectWallet = () => {
    dispatch({ type: "SET_RECONNECT", payload: true });
  };

  const handleReconnectWallet = () => {
    const email = localStorage.getItem("pw_user_email");
    if (email) {
      window.location.href = getOTPEmailAuthRoute(
        email,
        persistQuery(APP_ROUTES.VERIFY_EMAIL_OTP)
      );
    } else {
      window.location.href = getPushSocialAuthRoute(
        "google",
        persistQuery(APP_ROUTES.WALLET)
      );
    }
  };

  const handleReconnectExternalWallet = async (walletData: ExternalWalletType) => {
    try {
      dispatch({
        type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
        payload: "loading",
      });

      const providerReceived = walletRegistry.getProvider(walletData.providerName);

      const result = await connect(providerReceived, walletData.chainType);

      if (result) {
        dispatch({
          type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
          payload: "success",
        });
        dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        dispatch({ type: "SET_EXTERNAL_WALLET", payload: walletData });
      }
    } catch (error) {
      dispatch({
        type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
        payload: "rejected",
      });
    }
  };

  type ReadOnlyWalletConnectionData =
    | {
        status: string;
        address: string;
        providerName: IWalletProvider["name"];
        chainType: ChainType;
      }
    | {
        status: string;
        chain: CHAIN;
        address: string;
        providerName?: undefined;
      };

  const handleReadOnlyWalletConnection = (data: ReadOnlyWalletConnectionData) => {
    dispatch({ type: "SET_READ_ONLY", payload: true });
    if (data.providerName) {
      handleExternalWalletConnection(data);
    } else {
      handlePushWalletConnection(data);
    }
  }

  // Function to send messages to the main tab
  const sendMessageToMainTab = (data: unknown) => {
    if (window.parent) {
      try {
        window.parent.postMessage(data, getAppParamValue());
      } catch (error) {
        console.error("Error sending message to main tab:", error);
      }
    }
  };

  const handlePushWalletConnection = (data: {
    status: string;
    chain: CHAIN;
    address: string;
  }) => {
    if (data.status === 'successful') {

      const walletPayload: UniversalAccount = {
        address: data.address,
        chain: data.chain,
      };

      dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
      dispatch({ type: "SET_PUSH_WALLET", payload: walletPayload });
      navigate(`${persistQuery(APP_ROUTES.WALLET)}`, {
        replace: true,
      });
    } else {
      dispatch({
        type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
        payload: "rejected",
      });
    }
  };

  const handleExternalWalletConnection = (data: {
    status: string;
    address: string;
    providerName: IWalletProvider['name'];
    chainType: ChainType;
  }) => {
    if (data.status === 'successful') {
      const walletPayload: ExternalWalletType = {
        originAddress: data.address,
        chainType: data.chainType,
        providerName: data.providerName,
      };

      dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
      dispatch({ type: "SET_EXTERNAL_WALLET", payload: walletPayload });
      setExternalWallet(walletPayload);
      navigate(`${persistQuery(APP_ROUTES.WALLET)}`, {
        replace: true,
      });
    } else {
      dispatch({
        type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE",
        payload: "rejected",
      });
    }
  };

  const handleSignAndSendMessage = async (message: Uint8Array, requestId?: string) => {
    try {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });

      const signature = await walletRef.current.universalSigner.signMessage(message);

      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.SIGN_MESSAGE,
        requestId,
        data: { signature },
      });

      setTimeout(
        () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
        2000
      );
    } catch (error) {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "rejected" });
      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.ERROR,
        requestId,
        data: {
          error: bridgeError(error),
        },
      });
    }
  };

  const handleSignAndSendTransaction = async (txn: Uint8Array, requestId?: string) => {
    try {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });

      const signature = await walletRef.current.universalSigner.signAndSendTransaction(txn);

      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.SIGN_TRANSACTION,
        requestId,
        data: { signature },
      });

      setTimeout(
        () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
        2000
      );
    } catch (error) {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "rejected" });
      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.ERROR,
        requestId,
        data: {
          error: bridgeError(error),
        },
      });
    }
  };

  const handleSignTypedData = async (typedData: {
    domain: TypedDataDomain;
    types: TypedData;
    primaryType: string;
    message: Record<string, unknown>;
  }, requestId?: string) => {
    try {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });

      const signature = await walletRef.current.universalSigner.signTypedData(typedData);

      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.SIGN_TYPED_DATA,
        requestId,
        data: { signature },
      });

      setTimeout(
        () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
        2000
      );
    } catch (error) {
      dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "rejected" });
      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.ERROR,
        requestId,
        data: {
          error: bridgeError(error),
        },
      });
    }
  };

  const handleSignAuthorization = async (
    params: SignAuthorizationParams,
    requestId?: string,
  ) => {
    try {
      const signAuthorization = walletRef.current?.universalSigner.signAuthorization;
      if (typeof signAuthorization !== 'function') {
        throw new Error(EIP7702_UNSUPPORTED_ERROR);
      }

      const authorization = await signAuthorization(params);
      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.SIGN_AUTHORIZATION,
        requestId,
        data: { authorization },
      });
    } catch (error) {
      sendMessageToMainTab({
        type: WALLET_TO_APP_ACTION.ERROR,
        requestId,
        data: { error: bridgeError(error) },
      });
    }
  };

  const handleSocialConnection = (data: {
    account?: UniversalAccount,
    error?: boolean,
    supportsSignAuthorization?: boolean,
  }) => {
    setSocialConnectionLoading(false);

    if (data.error) {
      dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "rejected" });
      return;
    }

    const instance = {
      universalSigner: {
        signMessage: handleSendSignRequestToPushWallet,
        signTypedData: handleSendSignTypedDataRequestToPushWallet,
        signAndSendTransaction: handleSendSignTransactionRequestToPushWallet,
        ...(data.supportsSignAuthorization
          ? { signAuthorization: handleSendSignAuthorizationRequestToPushWallet }
          : {}),
        account: data.account
      }
    }

    dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
    dispatch({ type: "INITIALIZE_WALLET", payload: instance });

    localStorage.setItem(
      "walletInfo",
      JSON.stringify(data.account)
    );

    
    navigate(`${persistQuery(APP_ROUTES.WALLET)}`, {
      replace: true,
    });
  };

  // handles Push wallet signature request
  const handleSendSignRequestToPushWallet = (
    data: Uint8Array
  ): Promise<Uint8Array> => {
    dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });
    return signingRequestsRef.current.request<Uint8Array, WalletEventRespoonse>(
      APP_TO_WALLET_ACTION.SIGN_MESSAGE,
      data,
      sendMessageToMainTab,
      () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
    ).then((response) => response.signature!);
  };

  const handleSendSignTransactionRequestToPushWallet = (
    data: Uint8Array
  ): Promise<Uint8Array> => {
    dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });
    return signingRequestsRef.current.request<Uint8Array, WalletEventRespoonse>(
      APP_TO_WALLET_ACTION.SIGN_TRANSACTION,
      data,
      sendMessageToMainTab,
      () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
    ).then((response) => response.signature!);
  };

  const handleSendSignTypedDataRequestToPushWallet = (
    data: ITypedData
  ): Promise<Uint8Array> => {
    dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });
    return signingRequestsRef.current.request<ITypedData, WalletEventRespoonse>(
      APP_TO_WALLET_ACTION.SIGN_TYPED_DATA,
      data,
      sendMessageToMainTab,
      () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
    ).then((response) => response.signature!);
  };

  const handleSendSignAuthorizationRequestToPushWallet = (
    params: SignAuthorizationParams
  ): Promise<SignedAuthorization> => {
    dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "loading" });
    return signingRequestsRef.current.request<SignAuthorizationParams, WalletEventRespoonse>(
      APP_TO_WALLET_ACTION.SIGN_AUTHORIZATION,
      params,
      sendMessageToMainTab,
      () => dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" }),
    ).then((response) => response.authorization!);
  };

  const handleNewConnectionRequest = (origin: string) => {
    const appConnections = requestToConnectPushWallet(origin);

    // Checking if appConnection is already connected or not, if connected so emit success message
    const appFound = appConnections.find((each) => each.origin === origin);
    if (appFound.appConnectionStatus === "connected") {
      handleAppConnectionSuccess(origin);
      return;
    }

    dispatch({
      type: "SET_APP_CONNECTIONS",
      payload: appConnections,
    });
  };

  const handleAppConnectionSuccess = (origin: string) => {
    const appConnections = acceptPushWalletConnectionRequest(origin);

    dispatch({
      type: "SET_APP_CONNECTIONS",
      payload: appConnections,
    });

    const universalAccount = walletRef?.current?.universalSigner.account;

    localStorage.setItem(
      "walletInfo",
      JSON.stringify(universalAccount)
    );

    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.APP_CONNECTION_SUCCESS,
      data: {
        account: universalAccount,
        supportsSignAuthorization:
          typeof walletRef?.current?.universalSigner.signAuthorization === 'function',
      },
    });
  };

  const handleAppConnectionRejected = (origin: string) => {
    const appConnections = rejectPushWalletConnectionRequest(origin);

    dispatch({
      type: "SET_APP_CONNECTIONS",
      payload: appConnections,
    });

    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.APP_CONNECTION_REJECTED,
      data: {
        account: null,
      },
    });
  };

  const handleRejectAllAppConnections = () => {
    const appConnections = rejectAllPushWalletConnectionRequests();

    dispatch({
      type: "SET_APP_CONNECTIONS",
      payload: appConnections,
    });

    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.APP_CONNECTION_REJECTED,
      data: {
        account: null,
      },
    });
  };

  const handleWalletConfigs = (data: {
    loginDefaults: LoginMethodConfig,
    themeMode: typeof CONSTANTS.THEME.LIGHT | typeof CONSTANTS.THEME.DARK,
    appMetadata: AppMetadata,
    themeOverrides: Record<string, string>,
  }) => {

    data.themeMode === CONSTANTS.THEME.DARK ? enable() : disable();

    const walletConfig: WalletConfig = {
      loginDefaults: data.loginDefaults,
      appMetadata: data.appMetadata,
    }

    appDispatch({ type: "SET_THEME_OVERRIDES", payload: { ...data.themeOverrides } });
    appDispatch({ type: "SET_WALLET_CONFIG", payload: walletConfig });
    dispatch({ type: "WALLET_CONFIG", payload: walletConfig });
  }

  const handleRetryAppConnection = () => {
    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.APP_CONNECTION_RETRY,
      data: {
        account: null,
      },
    });
  };

  const handleCancelAppConnection = () => {
    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.APP_CONNECTION_CANCELLED,
    });
  };

  const handleUserLoggedIn = () => {

    const account = walletRef?.current?.universalSigner.account;

    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.IS_LOGGED_IN,
      data: {
        account: account ?? null,
        supportsSignAuthorization:
          typeof walletRef?.current?.universalSigner.signAuthorization === 'function',
      },
    });
  };

  const handleLogOutEvent = () => {
    dispatch({ type: "RESET_WALLET" });
    sessionStorage.removeItem("jwt");
    localStorage.removeItem("pw_user_email");
    localStorage.removeItem("walletInfo");
    logoutWaap();

    sendMessageToMainTab({
      type: WALLET_TO_APP_ACTION.IS_LOGGED_OUT,
      data: {
        account: null,
      },
    });
    setLoginEmitterStatus(false);
    walletRef.current = null;
  };

  const handleAuthStateParam = (state: string) => {
    dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "idle" });
    dispatch({ type: "SET_RECONNECT", payload: false });
    navigate(`${persistQuery(APP_ROUTES.WALLET, state)}`, {
      replace: true,
    });
  };

  return (
    <WalletContext.Provider
      value={{
        handleUserLoggedIn,
        handleLogOutEvent,
        handleAppConnectionSuccess,
        handleAppConnectionRejected,
        handleRejectAllAppConnections,
        handleRetryAppConnection,
        sendMessageToMainTab,
        txhash,
        setTxhash,
        handleReconnectWallet,
        handleReconnectExternalWallet,
        handleCancelAppConnection,
        socialConnectionLoading,
        setSocialConnectionLoading,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

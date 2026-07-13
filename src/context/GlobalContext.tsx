import {
  createContext,
  ReactNode,
  useContext,
  useReducer,
  useEffect,
} from "react";
import { fetchJwtUsingState } from "../helpers/AuthHelper";
import {
  getAllAppConnections,
  PushWalletAppConnectionData,
} from "../common";
import { APP_ROUTES } from "../constants";
import { useExternalWallet } from "./ExternalWalletContext";
import { WalletConfig, ExternalWalletType, UniversalAccount, ITypedData } from "../types/wallet.types";
import { PushWallet } from "../services/pushWallet/pushWallet";
import type { SignAuthorizationParams, SignedAuthorization } from '@pushchain/core';

export type PushWalletSocial = {
  universalSigner: {
    signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    signTypedData: (typedData: ITypedData) => Promise<Uint8Array>;
    signAndSendTransaction: (txn: Uint8Array) => Promise<Uint8Array>;
    signAuthorization?: (
      params: SignAuthorizationParams
    ) => Promise<SignedAuthorization>;
    account: UniversalAccount;
  };
}

export type Wallet = PushWallet | PushWalletSocial;

// Define the shape of the global state
export type GlobalState = {
  wallet: Wallet | null;
  appConnections: PushWalletAppConnectionData[];
  externalWallet: ExternalWalletType | null;
  pushWallet: UniversalAccount | null;
  theme: "light" | "dark";
  user: any;
  isAuthenticated: boolean;
  jwt: string | null;
  walletConfig: WalletConfig | null;
  walletLoadState: "idle" | "success" | "loading" | "rejected";
  messageSignState: "idle" | "loading" | "rejected";
  externalWalletAppConnectionStatus: "pending" | "connected";
  externalWalletAuthState:
  | "idle"
  | "success"
  | "loading"
  | "rejected"
  | "timeout"
  | "not_installed";
  isReadOnly: boolean;
  reconnect: boolean;
  showUpgradeDrawer: boolean;
  upgradeInfo: {
    currentVersion: string;
    newVersion: string;
  } | null;
  upgradeChecked: boolean;
};

// Define actions for state management
export type GlobalAction =
  | { type: "INITIALIZE_WALLET"; payload: Wallet }
  | { type: "SET_APP_CONNECTIONS"; payload: PushWalletAppConnectionData[] }
  | { type: "SET_EXTERNAL_WALLET"; payload: ExternalWalletType }
  | { type: "SET_PUSH_WALLET"; payload: UniversalAccount }
  | { type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE"; payload: GlobalState["externalWalletAuthState"] }
  | { type: "RESET_WALLET" }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "SET_USER"; payload: any }
  | { type: "SET_AUTHENTICATED"; payload: boolean }
  | { type: "SET_JWT"; payload: string }
  | { type: "WALLET_CONFIG"; payload: WalletConfig }
  | { type: "SET_WALLET_LOAD_STATE"; payload: GlobalState["walletLoadState"] }
  | { type: "SET_MESSAGE_SIGN_STATE"; payload: GlobalState["messageSignState"] }
  | {
    type: "SET_EXTERNAL_WALLET_APP_CONNECTION_STATUS";
    payload: GlobalState["externalWalletAppConnectionStatus"];
  }
  | { type: "SET_READ_ONLY"; payload: boolean }
  | { type: "SET_RECONNECT"; payload: boolean }
  | { type: "SHOW_UPGRADE_DRAWER"; payload: { currentVersion: string; newVersion: string } }
  | { type: "HIDE_UPGRADE_DRAWER" }
  | { type: "SET_UPGRADE_CHECKED"; payload: boolean };

// Initial state
const initialState: GlobalState = {
  wallet: null,
  appConnections: getAllAppConnections(),
  pushWallet: null,
  externalWallet: null,
  theme: "light",
  user: null,
  isAuthenticated: false,
  jwt: null,
  walletConfig: null,
  walletLoadState: "idle",
  messageSignState: "idle",
  externalWalletAppConnectionStatus: "pending",
  externalWalletAuthState: "idle",
  isReadOnly: false,
  reconnect: false,
  showUpgradeDrawer: false,
  upgradeInfo: null,
  upgradeChecked: false,
};

// Reducer function to manage state transitions
function globalReducer(state: GlobalState, action: GlobalAction): GlobalState {
  switch (action.type) {
    case "INITIALIZE_WALLET":
      return {
        ...state,
        wallet: action.payload,
      };
    case "SET_APP_CONNECTIONS":
      return {
        ...state,
        appConnections: action.payload,
      };
    case "SET_EXTERNAL_WALLET":
      return {
        ...state,
        externalWallet: action.payload,
      };
    case "SET_PUSH_WALLET":
      return {
        ...state,
        pushWallet: action.payload,
      };
    case "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE":
      return {
        ...state,
        externalWalletAuthState: action.payload,
      };
    // Reset your all the state variable while logging out
    case "RESET_WALLET":
      return {
        ...state,
        ...initialState,
        walletConfig: state.walletConfig,
      };
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_AUTHENTICATED":
      return { ...state, isAuthenticated: action.payload };
    case "SET_JWT":
      return { ...state, jwt: action.payload };
    case "WALLET_CONFIG":
      return { ...state, walletConfig: action.payload };
    case "SET_WALLET_LOAD_STATE":
      return { ...state, walletLoadState: action.payload };
    case "SET_MESSAGE_SIGN_STATE":
      return {
        ...state,
        messageSignState: action.payload,
      };
    case "SET_EXTERNAL_WALLET_APP_CONNECTION_STATUS":
      return { ...state, externalWalletAppConnectionStatus: action.payload };
    case "SET_READ_ONLY":
      return {
        ...state,
        isReadOnly: action.payload,
      };
    case "SET_RECONNECT":
      return {
        ...state,
        reconnect: action.payload,
      };
    case "SHOW_UPGRADE_DRAWER":
      return {
        ...state,
        showUpgradeDrawer: true,
        upgradeInfo: action.payload,
      };
    case "HIDE_UPGRADE_DRAWER":
      return {
        ...state,
        showUpgradeDrawer: false,
        upgradeInfo: null,
      };
    case "SET_UPGRADE_CHECKED":
      return {
        ...state,
        upgradeChecked: action.payload,
      };
    default:
      return state;
  }
}

// Create context
const GlobalContext = createContext<{
  state: GlobalState;
  dispatch: React.Dispatch<GlobalAction>;
}>({
  state: initialState,
  dispatch: () => null, // Placeholder function for initial context
});

// Custom hook to use the GlobalContext
export function useGlobalState() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalProvider");
  }
  return context;
}

// Provider component to wrap around your app
export const GlobalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(globalReducer, initialState);

  const params = new URLSearchParams(location.search);

  const { externalWallet } = useExternalWallet();

  const stateParam = params.get("state");

  const storedToken = sessionStorage.getItem("jwt");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "loading" });

        // This condition is valid for social login and email for redirection during login
        if (stateParam) {
          const jwtToken = await fetchJwtUsingState({
            stateParam,
          });

          sessionStorage.setItem("jwt", jwtToken);
          const url = new URL(window.location.href);
          url.searchParams.delete("state");
          window.history.replaceState({}, document.title, url.toString());

          dispatch({ type: "SET_JWT", payload: jwtToken });
          dispatch({ type: "SET_READ_ONLY", payload: false });
          dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        }

        // This condition is valid for social login and email for during reload
        if (storedToken) {
          dispatch({ type: "SET_JWT", payload: storedToken });

          dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        }

        if (state.wallet?.universalSigner.account) {
          dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        }

        if (externalWallet) {
          dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
          dispatch({ type: "SET_EXTERNAL_WALLET", payload: externalWallet });
        }

        if (!stateParam && !storedToken && !externalWallet && !state.wallet?.universalSigner.account) {
          dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "rejected" });
        }
      } catch (error) {
        dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "rejected" });
        console.error("Error creating wallet:", error);
        throw error;
      }
    };

    // We don't need to do jwt token network calls on the oauth route to avoid expiring the token
    window.location.pathname !== APP_ROUTES.OAUTH_REDIRECT && fetchUser();
  }, [stateParam, storedToken, externalWallet, state.wallet]);

  return (
    <GlobalContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

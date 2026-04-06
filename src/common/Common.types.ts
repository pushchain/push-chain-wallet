import { ReactNode } from "react";

export type WalletCategoriesType = {
  chain: string;
  wallet: 'ethereum' | 'solana';
  label: string;
  icon: ReactNode;
};

export enum WALLET_TO_APP_ACTION {
  IS_LOGGED_IN = "isLoggedIn",

  APP_CONNECTION_REJECTED = "appConnectionRejected",
  APP_CONNECTION_SUCCESS = "appConnectionSuccess",
  APP_CONNECTION_RETRY = "appConnectionRetry",
  APP_CONNECTION_CANCELLED = 'appConnectionCancelled',

  SIGN_MESSAGE = "signatureMessage",
  SIGN_TRANSACTION = "signatureTransaction",
  SIGN_TYPED_DATA = "signatureTypedData",

  IS_LOGGED_OUT = "loggedOut",
  TAB_CLOSED = "tabClosed",
  ERROR = "error",

  CONNECT_WALLET = "connectWallet",
  CONNECT_SOCIAL = "connectSocial",

  PUSH_SEND_TRANSACTION = 'pushSendTransaction',

  CLOSE_IFRAME = 'closeIFrame',

  UPGRADE_ACCOUNT_REQUEST = 'upgradeAccountRequest',
  UPGRADE_ACCOUNT_SUCCESS = 'upgradeAccountSuccess',
  UPGRADE_ACCOUNT_ERROR = 'upgradeAccountError',
}

export enum APP_TO_WALLET_ACTION {
  NEW_CONNECTION_REQUEST = "newConnectionRequest",
  SIGN_MESSAGE = 'signMessage',
  SIGN_TRANSACTION = 'signTransaction',
  SIGN_TYPED_DATA = 'signTypedData',
  ERROR = "error",
  LOG_OUT = "logOut",

  CONNECTION_STATUS = "connectionStatus",
  SOCIAL_CONNECTION_STATUS = "socialConnectionStatus",
  WALLET_CONFIG = "walletConfig",

  PUSH_SEND_TRANSACTION_RESPONSE = 'pushSendTransactionResponse',
  READ_ONLY_CONNECTION_STATUS = 'readOnlyConnectionStatus',
  RECONNECT_WALLET = 'ReconnectWallet',

  SHOW_UPGRADE_DRAWER = 'showUpgradeDrawer',
  UPGRADE_ACCOUNT_RESPONSE = 'upgradeAccountResponse',
}

export enum WALLET_TO_WALLET_ACTION {
  AUTH_STATE_PARAM = "authStateParam",
  REAUTH_PARAM = "reauthParam",
  CLOSE_TAB = "closetab",
}

export type PushWalletAppConnectionData = {
  origin: string;
  appConnectionStatus: "connected" | "pending";
};

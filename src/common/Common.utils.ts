import { Wallet } from "../context/GlobalContext";
import { PushWalletAppConnectionData } from "./Common.types";
import { PushWallet } from "../services/pushWallet/pushWallet";

export const centerMaskWalletAddress = (address: string, length?: number) => {
  if (address) {
    const start = address.substring(0, length ?? 7);
    const end = address.substring(address.length - (length ?? 7));
    return start + "..." + end;
  }
  return "";
};

export const handleCopy = async (
  text: string,
  onCopy?: (flag: boolean) => void
) => {
  try {
    await navigator.clipboard.writeText(text);
    onCopy?.(true);
    setTimeout(() => onCopy?.(false), 2000); // Reset the copied state after 2 seconds
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }
};

export const getAppParamValue = () => {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("app");
};

export const getVersionParamValue = () => {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("version");
};

export const isUIKitVersion = (v: string) => {
  const searchParams = new URLSearchParams(window.location.search);

  const app = searchParams.get("app");

  const version = searchParams.get("version");

  return !!app && (version >= v);
};

export const isClassicPushWallet = (w: Wallet | null): w is PushWallet => {
  return (
    !!w &&
    typeof w === "object" &&
    "mnemonic" in w &&
    "storeMnemonicShareAsEncryptedTx" in w &&
    "walletToEncDerivedKey" in w
  );
};

export const getAllAppConnections = (): PushWalletAppConnectionData[] =>
  localStorage.getItem("appConnections")
    ? JSON.parse(localStorage.getItem("appConnections"))
    : [];

export const requestToConnectPushWallet = (
  origin: string
): PushWalletAppConnectionData[] => {
  const previousAppConnections = getAllAppConnections();

  const appFound = previousAppConnections.find(
    (each) => each.origin === origin
  );

  if (!appFound) {
    const updatedAppConnections = [
      ...previousAppConnections,
      {
        origin,
        appConnectionStatus: "pending",
      },
    ];

    // Store updated appConnections in localStorage
    localStorage.setItem(
      "appConnections",
      JSON.stringify(updatedAppConnections)
    );
  }

  return getAllAppConnections();
};

export const acceptPushWalletConnectionRequest = (
  origin: string
): PushWalletAppConnectionData[] => {
  const previousAppConnections = getAllAppConnections();
  const appFound = previousAppConnections.find(
    (each) => each.origin === origin
  );
  if (appFound) {
    const updatedAppConnections = previousAppConnections.map((each) =>
      each.origin === appFound.origin
        ? {
          ...appFound,
          appConnectionStatus: "connected",
        }
        : each
    );

    // Store updated appConnections in localStorage
    localStorage.setItem(
      "appConnections",
      JSON.stringify(updatedAppConnections)
    );
  }

  return getAllAppConnections();
};

export const rejectPushWalletConnectionRequest = (
  origin: string
): PushWalletAppConnectionData[] => {
  const previousAppConnections = getAllAppConnections();
  const updatedAppConnections = previousAppConnections.filter(
    (each) => each.origin !== origin
  );

  // Store updated appConnections in localStorage
  localStorage.setItem("appConnections", JSON.stringify(updatedAppConnections));

  return getAllAppConnections();
};

export const rejectAllPushWalletConnectionRequests =
  (): PushWalletAppConnectionData[] => {
    const previousAppConnections = getAllAppConnections();

    const updatedAppConnections = previousAppConnections.filter(
      (each) => each.appConnectionStatus !== "pending"
    );

    // Store updated appConnections in localStorage
    localStorage.setItem(
      "appConnections",
      JSON.stringify(updatedAppConnections)
    );

    return getAllAppConnections();
  };


export const truncateToDecimals = (num, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
}

export const modifyAddress = (balance, number) => {
  return Number(truncateToDecimals(Number(balance ?? '0'), number)).toLocaleString()
}

export const truncateWords = (str: string, numWords: number = 50): string => {
  if (!str) return '';
  const words = str.split(' ');
  if (words.length <= numWords) return str;
  return words.slice(0, numWords).join(' ') + '…';
};
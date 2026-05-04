import { createContext, ReactNode, useContext, useState } from "react";
import {
  ChainType,
  ExternalWalletType,
  ITypedData,
  IWalletProvider,
} from "../types/wallet.types";
import { walletRegistry } from "../providers/WalletProviderRegistry";

type ExternalWalletContextType = {
  externalWallet: ExternalWalletType | null;
  setExternalWallet: React.Dispatch<React.SetStateAction<ExternalWalletType | null>>;
  connecting: boolean;
  connect: (
    provider: IWalletProvider,
    chainType?: ChainType
  ) => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransactionRequest: (data: Uint8Array) => Promise<Uint8Array>;
  signMessageRequest: (data: Uint8Array) => Promise<Uint8Array>;
  signTypedDataRequest: (data: ITypedData) => Promise<Uint8Array>;

  isWalletInstalled: (provider: IWalletProvider) => Promise<boolean>;
};

const ExternalWalletContext = createContext<ExternalWalletContextType | undefined>(undefined);

const getStoredExternalWallet = (): ExternalWalletType | null => {
  try {
    const walletInfo = localStorage.getItem("walletInfo");
    const walletData = walletInfo ? JSON.parse(walletInfo) : null;

    if (
      walletData?.originAddress &&
      walletData?.providerName &&
      walletData?.chainType
    ) {
      return walletData;
    }
  } catch (error) {
    console.error("Failed to read stored external wallet:", error);
  }

  return null;
};

export const ExternalWalletContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [externalWallet, setExternalWallet] = useState<ExternalWalletType | null>(
    getStoredExternalWallet
  );
  const [currentProvider, setCurrentProvider] =
    useState<IWalletProvider | null>(null);
  const [connecting, setConnecting] = useState(false);

  const isWalletInstalled = async (
    provider: IWalletProvider
  ): Promise<boolean> => {
    try {
      return await provider.isInstalled();
    } catch {
      return false;
    }
  };

  const connect = async (provider: IWalletProvider, chainType?: ChainType) => {
    try {
      setConnecting(true);
      const { caipAddress } = await provider.connect(chainType);

      const walletDetails: ExternalWalletType = {
        originAddress: caipAddress,
        chainType,
        providerName: provider.name,
      };

      localStorage.setItem(
        "walletInfo",
        JSON.stringify(walletDetails)
      );

      setExternalWallet(walletDetails);
      setCurrentProvider(provider);
      return caipAddress;
    } catch (error) {
      throw new Error("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (currentProvider) {
      try {
        await currentProvider.disconnect();
        setExternalWallet(null);
        setCurrentProvider(null);
      } catch (error) {
        console.error("Failed to disconnect:", error);
        throw new Error("Failed to disconnect wallet");
      }
    }
  };

  const signTransactionRequest = async (
    data: Uint8Array
  ): Promise<Uint8Array> => {
    if (!externalWallet) {
      throw new Error("No wallet connected");
    }

    try {
      const providerReceived = walletRegistry.getProvider(
        externalWallet.providerName
      );
      const signature = await providerReceived.signAndSendTransaction(data);
      return signature;
    } catch (error) {
      console.log("Error in generating signature", error);
      throw new Error("Signature request failed");
    }
  };

  const signMessageRequest = async (data: Uint8Array): Promise<Uint8Array> => {
    if (!externalWallet) {
      throw new Error("No wallet connected");
    }

    try {
      const providerReceived = walletRegistry.getProvider(
        externalWallet.providerName
      );
      const signature = await providerReceived.signMessage(data);
      return signature;
    } catch (error) {
      console.log("Error in generating signature", error);
      throw new Error("Signature request failed");
    }
  };

  const signTypedDataRequest = async (
    data: ITypedData
  ): Promise<Uint8Array> => {
    if (!externalWallet) {
      throw new Error("No wallet connected");
    }

    try {
      const providerReceived = walletRegistry.getProvider(
        externalWallet.providerName
      );
      const signature = await providerReceived.signTypedData(data);
      return signature;
    } catch (error) {
      console.log("Error in generating signature", error);
      throw new Error("Signature request failed");
    }
  };

  return (
    <ExternalWalletContext.Provider
      value={{
        externalWallet,
        setExternalWallet,
        connecting,
        connect,
        isWalletInstalled,
        disconnect,
        signTransactionRequest,
        signMessageRequest,
        signTypedDataRequest,
      }}
    >
      {children}
    </ExternalWalletContext.Provider>
  );
};

export function useExternalWallet() {
  const context = useContext(ExternalWalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

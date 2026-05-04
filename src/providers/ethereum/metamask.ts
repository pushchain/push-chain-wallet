import { MetaMaskSDK } from "@metamask/sdk";
import { ChainType, ITypedData } from "../../types/wallet.types";
import { BaseWalletProvider } from "../BaseWalletProvider";
import { bytesToHex, hexToBytes, parseTransaction } from "viem";
import { BrowserProvider } from 'ethers';
import { Chain } from 'viem';
import { chains } from "./chains";
import { toHex } from "viem";
import { getAddress } from 'ethers';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask: boolean;
    };
  }
}

export class MetamaskProvider extends BaseWalletProvider {
  private sdk: MetaMaskSDK;

  constructor() {
    super("MetaMask", "https://metamask.io/images/metamask-fox.svg", [
      ChainType.ETHEREUM,
      ChainType.ARBITRUM,
      ChainType.BASE,
      ChainType.PUSH_WALLET,
      ChainType.BINANCE,
    ]);
    this.sdk = new MetaMaskSDK({
      dappMetadata: {
        name: "Push Wallet",
        url: window.location.href,
      },
      logging: {
        sdk: false,
      },
      useDeeplink: true,
      injectProvider: true,
    });
  }

  isInstalled = async (): Promise<boolean> => {
    if (window.ethereum && window.ethereum.isMetaMask) return true;

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) return true;

    return false;
  };

  getProvider = () => {
    return this.sdk.getProvider();
  };

  getSigner = async () => {
    const sdkProvider = this.sdk.getProvider();
    if (!sdkProvider) {
      throw new Error('Provider is undefined');
    }
    const browserProvider = new BrowserProvider(sdkProvider);
    return await browserProvider.getSigner();
  };

  getChainId = async (): Promise<number> => {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Provider is undefined');
    }
    const hexChainId = await provider.request({
      method: 'eth_chainId',
      params: [],
    });

    const chainId = parseInt(hexChainId.toString(), 16);
    return chainId;
  };

  async connect(chainType: ChainType): Promise<{ caipAddress: string }> {
    try {
      const accounts = await this.sdk.connect();
      const rawAddress = accounts[0];
      const checksumAddress = getAddress(rawAddress);

      await this.switchNetwork(chainType);

      const chainId = await this.getChainId();

      const addressincaip = this.formatAddress(checksumAddress, ChainType.ETHEREUM, chainId);

      return addressincaip;

    } catch (error) {
      console.error("Failed to connect to MetaMask:", error);
      throw error;
    }
  }

  switchNetwork = async (chainName: ChainType) => {
    const network = chains[chainName] as Chain;
    const provider = this.getProvider();

    const hexNetworkId = toHex(network.id);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexNetworkId }]
      });
    } catch (err) {
      if (err.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: hexNetworkId,
              chainName: network.name,
              rpcUrls: network.rpcUrls.default.http,
              nativeCurrency: network.nativeCurrency,
              blockExplorerUrls: network.blockExplorers.default.url
            }]
          });
        } catch (addError) {
          console.error("Error adding network:", addError);
          throw addError
        }
      } else {
        console.error("Error switching network:", err);
        throw err;
      }
    }

  }

  signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error('Provider is undefined');
      }
      const accounts = (await provider.request({
        method: 'eth_accounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No connected account');
      }

      const hexMessage = bytesToHex(message);

      const signature = await provider.request({
        method: 'personal_sign',
        params: [hexMessage, accounts[0]],
      });

      return hexToBytes(signature as `0x${string}`);
    } catch (error) {
      console.error('MetaMask signing error:', error);
      throw error;
    }
  };

  signAndSendTransaction = async (txn: Uint8Array): Promise<Uint8Array> => {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error('Provider is undefined');
      }
      const accounts = (await provider.request({
        method: 'eth_accounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No connected account');
      }

      const hex = bytesToHex(txn);
      const parsed = parseTransaction(hex);

      const txParams = {
        from: accounts[0],
        to: parsed.to,
        value: parsed.value ? '0x' + parsed.value.toString(16) : undefined,
        data: parsed.data,
        gas: parsed.gas ? '0x' + parsed.gas.toString(16) : undefined,
        maxPriorityFeePerGas: parsed.maxPriorityFeePerGas
          ? '0x' + parsed.maxPriorityFeePerGas.toString(16)
          : undefined,
        maxFeePerGas: parsed.maxFeePerGas
          ? '0x' + parsed.maxFeePerGas.toString(16)
          : undefined,
      };

      const signature = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      return hexToBytes(signature as `0x${string}`);
    } catch (error) {
      console.error('MetaMask signing error:', error);
      throw error;
    }
  };

  signTypedData = async (typedData: ITypedData): Promise<Uint8Array> => {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error('Provider is undefined');
      }
      const accounts = (await provider.request({
        method: 'eth_accounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No connected account');
      }

      typedData.types = {
        EIP712Domain: [
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...(typedData.primaryType === 'MigrationPayload'
          ? { MigrationPayload: typedData.types['MigrationPayload'] }
          : { UniversalPayload: typedData.types['UniversalPayload'] }),
      };

      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [accounts[0], JSON.stringify(typedData)],
      });

      return hexToBytes(signature as `0x${string}`);
    } catch (error) {
      console.error('MetaMask signing error:', error);
      throw error;
    }
  };


  disconnect = async () => {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Provider is undefined');
    }
    await provider.request({
      method: 'wallet_revokePermissions',
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  };
}

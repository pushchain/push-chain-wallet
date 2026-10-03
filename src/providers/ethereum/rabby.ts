import { BrowserProvider, getAddress } from "ethers";
import { bytesToHex, hexToBytes, parseTransaction } from "viem";

import { ChainType, ITypedData } from "../../types/wallet.types";
import { BaseWalletProvider } from "../BaseWalletProvider";
import { getEIP6963ProviderByRdns } from "../utils/eip6963";
import { serializeTypedData } from "../utils/serializeTypedData";
import { switchOrAddEvmChain } from "../utils/switchEvmChain";

export class RabbyProvider extends BaseWalletProvider {
  constructor() {
    super("Rabby", "https://rabby.io/logo.svg", [
      ChainType.ETHEREUM,
      ChainType.ARBITRUM,
      ChainType.BASE,
      ChainType.PUSH_WALLET,
      ChainType.BINANCE,
    ]);
  }

  isInstalled = async (): Promise<boolean> => {
    try {
      return !!this.getProvider();
    } catch {
      return false;
    }
  };

  private getProvider = () => {
    const provider = getEIP6963ProviderByRdns("io.rabby");
    if (!provider) {
      throw new Error("Rabby provider not found via EIP-6963");
    }
    return provider;
  };

  getSigner = async () => {
    const provider = this.getProvider();
    const browserProvider = new BrowserProvider(provider);
    return await browserProvider.getSigner();
  };

  getChainId = async (): Promise<number> => {
    const provider = this.getProvider();
    const hexChainId = await provider.request({
      method: "eth_chainId",
      params: [],
    });

    return parseInt(hexChainId.toString(), 16);
  };

  connect = async (chainType: ChainType): Promise<{ caipAddress: string }> => {
    const provider = this.getProvider();

    const accounts = (await provider.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No Rabby account returned");
    }

    const checksumAddress = getAddress(accounts[0]);

    await this.switchNetwork(chainType);
    const chainId = await this.getChainId();

    const caipAddress = this.formatAddress(
      checksumAddress,
      ChainType.ETHEREUM,
      chainId
    );

    return caipAddress;
  };

  switchNetwork = async (chainName: ChainType) => {
    await switchOrAddEvmChain(this.getProvider(), chainName);
  };


  signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    const provider = this.getProvider();

    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No connected Rabby account");
    }

    const hexMessage = bytesToHex(message);

    const signature = await provider.request({
      method: "personal_sign",
      params: [hexMessage, accounts[0]],
    });

    return hexToBytes(signature as `0x${string}`);
  };

  signAndSendTransaction = async (txn: Uint8Array): Promise<Uint8Array> => {
    const provider = this.getProvider();

    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No connected Rabby account");
    }

    const hex = bytesToHex(txn);
    const parsed = parseTransaction(hex);

    const txParams = {
      from: accounts[0],
      to: parsed.to,
      value: parsed.value ? "0x" + parsed.value.toString(16) : undefined,
      data: parsed.data,
      gas: parsed.gas ? "0x" + parsed.gas.toString(16) : undefined,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas
        ? "0x" + parsed.maxPriorityFeePerGas.toString(16)
        : undefined,
      maxFeePerGas: parsed.maxFeePerGas
        ? "0x" + parsed.maxFeePerGas.toString(16)
        : undefined,
    };

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    return hexToBytes(txHash as `0x${string}`);
  };

  signTypedData = async (typedData: ITypedData): Promise<Uint8Array> => {
    const provider = this.getProvider();

    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No connected Rabby account");
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
      method: "eth_signTypedData_v4",
      params: [accounts[0], serializeTypedData(typedData)],
    });

    return hexToBytes(signature as `0x${string}`);
  };

  disconnect = async () => {
    const provider = getEIP6963ProviderByRdns("io.rabby");
    if (!provider) return;

    await provider.request({
      method: "wallet_revokePermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  };
}

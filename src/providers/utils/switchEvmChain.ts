import { toHex, type Chain } from "viem";
import { ChainType } from "../../types/wallet.types";
import { chains } from "../ethereum/chains";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * True when a failed `wallet_switchEthereumChain` means the wallet does not
 * know the chain yet. Desktop wallets use 4902 (EIP-3326); MetaMask Mobile
 * reports it as -32603 or only in the message.
 */
export const isUnknownChainError = (err: unknown) => {
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
  return (
    code === 4902 ||
    code === -32603 ||
    String(message ?? "").includes("Unrecognized chain ID")
  );
};

/**
 * Switches an injected EVM wallet to `chainName`, adding the chain first if
 * the wallet does not know it.
 */
export const switchOrAddEvmChain = async (
  provider: Eip1193Provider | null | undefined,
  chainName: ChainType
) => {
  if (!provider) {
    throw new Error("Provider is undefined");
  }

  const network = chains[chainName] as Chain | undefined;
  if (!network?.id) {
    throw new Error(`Unsupported EVM chain: ${chainName}`);
  }

  const chainId = toHex(network.id);
  const switchChain = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });

  try {
    await switchChain();
  } catch (err) {
    if (!isUnknownChainError(err)) {
      console.error("Error switching network:", err);
      throw err;
    }

    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: network.name,
            rpcUrls: network.rpcUrls.default.http,
            nativeCurrency: network.nativeCurrency,
            // EIP-3085 declares blockExplorerUrls as string[]; a bare string
            // is rejected by the wallet, so the add never lands.
            blockExplorerUrls: network.blockExplorers?.default?.url
              ? [network.blockExplorers.default.url]
              : [],
          },
        ],
      });

      // Adding a chain is not guaranteed to switch to it (EIP-3085). Without
      // this second switch the wallet can stay on the old chain and the next
      // transaction is sent to the wrong network.
      await switchChain();
    } catch (addError) {
      console.error("Error adding network:", addError);
      throw addError;
    }
  }
};

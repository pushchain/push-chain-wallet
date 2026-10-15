import { createPublicClient, erc20Abi, getAddress, http, type Abi } from 'viem';
import { CHAIN_INFO } from '@pushchain/core/src/lib/constants/chain';
import type { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { AgenticNetwork, CustomToken } from './agenticWallet.types';

/*
 * Best-effort metadata for custom contracts and tokens. Blockscout serves verified
 * contract names, ABIs and token metadata with open CORS; chains without an instance
 * (BNB testnet) fall back to the chain RPC for tokens, and to the owner typing an app name.
 */

type BlockscoutContract = {
  name?: string;
  abi?: Abi;
  implementations?: { address?: string; address_hash?: string }[];
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const fetchContract = (network: AgenticNetwork, address: string) =>
  network.explorerApi
    ? fetchJson<BlockscoutContract>(`${network.explorerApi}/api/v2/smart-contracts/${address}`)
    : Promise.resolve(null);

/** Verified contract name and ABI. For proxies, the implementation's name and ABI win. */
export const fetchContractInfo = async (
  network: AgenticNetwork,
  address: string,
): Promise<{ name?: string; abi?: Abi }> => {
  const contract = await fetchContract(network, address);
  if (!contract) return {};

  const implementation = contract.implementations?.[0];
  const implementationAddress = implementation?.address_hash ?? implementation?.address;
  if (implementationAddress) {
    const impl = await fetchContract(network, implementationAddress);
    if (impl?.abi?.length) return { name: impl.name ?? contract.name, abi: impl.abi };
  }
  return { name: contract.name, abi: contract.abi };
};

type BlockscoutToken = { symbol?: string; decimals?: string | null };

export const fetchTokenInfo = async (network: AgenticNetwork, address: string): Promise<CustomToken | null> => {
  const checksummed = getAddress(address);

  if (network.explorerApi) {
    const token = await fetchJson<BlockscoutToken>(`${network.explorerApi}/api/v2/tokens/${checksummed}`);
    if (token?.symbol && token.decimals != null) {
      return { address: checksummed, symbol: token.symbol, decimals: Number(token.decimals) };
    }
  }

  const rpc = CHAIN_INFO[network.chain as CHAIN]?.defaultRPC?.[0];
  if (!rpc) return null;
  try {
    const client = createPublicClient({ transport: http(rpc) });
    const read = (functionName: 'symbol' | 'decimals') =>
      client.readContract({ address: checksummed, abi: erc20Abi, functionName, args: [] } as never);
    const [symbol, decimals] = (await Promise.all([read('symbol'), read('decimals')])) as [string, number];
    return { address: checksummed, symbol, decimals };
  } catch {
    return null;
  }
};

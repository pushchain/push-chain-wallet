import { PushChain } from '@pushchain/core';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import {
  Connection,
  ParsedAccountData,
  PublicKey,
} from '@solana/web3.js';
import {
  Address,
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  multicall3Abi,
} from 'viem';
import { EVM_CHAIN_CONFIGS } from '../../Wallet.utils';
import { PUSH_CHAIN_ID, ZERO_ADDRESS } from './swap.constants';
import { SwapChain, SwapToken } from './swap.types';
import {
  getDestinationTokens,
  getSourceTokens,
  isPushChain,
} from './swap.utils';

export const SWAP_ACCOUNT_QUERY_ROOT = ['wallet-swap-account'] as const;
export const SWAP_BALANCE_QUERY_ROOT = ['wallet-swap-balances'] as const;

export const SWAP_BALANCE_STALE_TIME = 15_000;
export const SWAP_BALANCE_GC_TIME = 5 * 60_000;
export const SWAP_ACCOUNT_GC_TIME = 24 * 60 * 60_000;

export type SwapOriginAccount = {
  chain: string;
  address: string;
};

export type SwapTokenBalanceMap = Record<string, string>;

type MulticallResult =
  | {
      status: 'success';
      result: unknown;
    }
  | {
      status: 'failure';
      error?: unknown;
    };

export type SwapEvmBalanceClient = {
  getBalance: (parameters: { address: Address }) => Promise<bigint>;
  multicall: (parameters: {
    contracts: readonly unknown[];
    allowFailure: true;
    batchSize: number;
    deployless?: boolean;
  }) => Promise<readonly MulticallResult[]>;
};

export type SwapSolanaConnection = {
  getBalance: (owner: PublicKey) => Promise<number>;
  getParsedTokenAccountsByOwner: (
    owner: PublicKey,
    filter: { programId: PublicKey },
  ) => Promise<{
    value: {
      account: {
        data: unknown;
      };
    }[];
  }>;
};

export type ResolveSwapAccountParams = {
  chain: SwapChain;
  executorAddress: string;
  origin: SwapOriginAccount;
  deriveExecutorAccount?: (
    account: SwapOriginAccount,
    options: {
      chain: CHAIN;
      skipNetworkCheck: true;
    },
  ) => Promise<{ address: string }>;
};

export type FetchSwapChainBalancesParams = {
  chain: SwapChain;
  account: string;
  tokens?: SwapToken[];
  evmClient?: SwapEvmBalanceClient;
  solanaConnection?: SwapSolanaConnection;
};

const SOLANA_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';
const solanaConnection = new Connection(SOLANA_DEVNET_RPC);
const evmClients = new Map<number, SwapEvmBalanceClient>();

const isSolanaChain = (chain: SwapChain) => chain.startsWith('solana:');

const getChainId = (chain: SwapChain) => {
  const [namespace, reference] = chain.split(':');
  if (namespace !== 'eip155' || !reference) return null;

  const chainId = Number(reference);
  return Number.isFinite(chainId) ? chainId : null;
};

const getEvmChainConfig = (chain: SwapChain) => {
  const chainId = getChainId(chain);
  if (chainId === null) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  const config =
    EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
  if (!config) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  return config;
};

const getEvmClient = (chain: SwapChain): SwapEvmBalanceClient => {
  const config = getEvmChainConfig(chain);
  const cached = evmClients.get(config.id);
  if (cached) return cached;

  const publicRpcUrl =
    'public' in config.rpcUrls
      ? config.rpcUrls.public.http[0]
      : undefined;
  const rpcUrl = publicRpcUrl ?? config.rpcUrls.default.http[0];
  const client = createPublicClient({
    chain: config,
    transport: http(rpcUrl, {
      retryCount: 2,
      retryDelay: 1_000,
    }),
  });
  const balanceClient = client as unknown as SwapEvmBalanceClient;
  evmClients.set(config.id, balanceClient);
  return balanceClient;
};

const isNativeToken = (token: SwapToken) =>
  token.mechanism === 'native' ||
  token.address.toLowerCase() === ZERO_ADDRESS;

const readMulticallBalance = (result: MulticallResult | undefined) =>
  result?.status === 'success' && typeof result.result === 'bigint'
    ? result.result
    : 0n;

const assertBatchAvailable = (
  results: readonly MulticallResult[],
  callCount: number,
) => {
  if (
    callCount > 0 &&
    results.length > 0 &&
    results.every((result) => result.status === 'failure')
  ) {
    throw new Error('Unable to fetch token balances');
  }
};

const formatSolanaAccountAddress = (address: string) => {
  if (!address.startsWith('0x')) return address;

  const hex = address.slice(2);
  if (hex.length !== 64 || !/^[\da-f]+$/i.test(hex)) return address;

  try {
    const bytes = Uint8Array.from(
      Array.from({ length: 32 }, (_, index) =>
        Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
      ),
    );
    return new PublicKey(bytes).toBase58();
  } catch {
    return address;
  }
};

export const getSwapTokenKey = (token: SwapToken) => {
  const address = token.chain.startsWith('eip155:')
    ? token.address.toLowerCase()
    : token.address;
  return `${token.chain}:${address}`;
};

export const getSwapTokensForChain = (chain: SwapChain) =>
  Array.from(
    new Map(
      [...getSourceTokens(chain), ...getDestinationTokens(chain)].map(
        (token) => [getSwapTokenKey(token), token],
      ),
    ).values(),
  );

export const getSwapTokenFingerprint = (tokens: SwapToken[]) =>
  tokens
    .map((token) => `${getSwapTokenKey(token)}:${token.decimals}`)
    .sort()
    .join('|');

export const getSwapAccountQueryKey = ({
  chain,
  executorAddress,
  origin,
}: Omit<ResolveSwapAccountParams, 'deriveExecutorAccount'>) =>
  [
    ...SWAP_ACCOUNT_QUERY_ROOT,
    executorAddress,
    origin.chain,
    origin.address,
    chain,
  ] as const;

export const getSwapBalanceQueryKey = ({
  chain,
  account,
  tokens = getSwapTokensForChain(chain),
}: Pick<FetchSwapChainBalancesParams, 'chain' | 'account' | 'tokens'>) =>
  [
    ...SWAP_BALANCE_QUERY_ROOT,
    chain,
    account,
    getSwapTokenFingerprint(tokens),
  ] as const;

export const resolveSwapAccount = async ({
  chain,
  executorAddress,
  origin,
  deriveExecutorAccount = PushChain.utils.account.deriveExecutorAccount,
}: ResolveSwapAccountParams) => {
  if (isPushChain(chain)) return executorAddress;
  if (origin.chain === chain) {
    return isSolanaChain(chain)
      ? formatSolanaAccountAddress(origin.address)
      : origin.address;
  }

  const account = await deriveExecutorAccount(
    {
      chain: PUSH_CHAIN_ID,
      address: executorAddress,
    },
    {
      chain: chain as CHAIN,
      skipNetworkCheck: true,
    },
  );

  return isSolanaChain(chain)
    ? formatSolanaAccountAddress(account.address)
    : account.address;
};

export const fetchEvmSwapBalances = async ({
  chain,
  account,
  tokens = getSwapTokensForChain(chain),
  evmClient = getEvmClient(chain),
}: Omit<FetchSwapChainBalancesParams, 'solanaConnection'>) => {
  const balances: SwapTokenBalanceMap = Object.fromEntries(
    tokens.map((token) => [getSwapTokenKey(token), '0']),
  );
  const nativeTokens = tokens.filter(isNativeToken);
  const erc20Tokens = tokens.filter((token) => !isNativeToken(token));
  const erc20Calls = erc20Tokens.map((token) => ({
    address: token.address as Address,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [account as Address] as const,
  }));

  if (isPushChain(chain)) {
    const [nativeRaw, erc20Results] = await Promise.all([
      nativeTokens.length
        ? evmClient.getBalance({ address: account as Address })
        : Promise.resolve(0n),
      erc20Calls.length
        ? evmClient.multicall({
            contracts: erc20Calls,
            allowFailure: true,
            deployless: true,
            batchSize: 0,
          })
        : Promise.resolve([]),
    ]);

    assertBatchAvailable(erc20Results, erc20Calls.length);
    nativeTokens.forEach((token) => {
      balances[getSwapTokenKey(token)] = formatUnits(
        nativeRaw,
        token.decimals,
      );
    });
    erc20Tokens.forEach((token, index) => {
      balances[getSwapTokenKey(token)] = formatUnits(
        readMulticallBalance(erc20Results[index]),
        token.decimals,
      );
    });
    return balances;
  }

  const config = getEvmChainConfig(chain);
  const multicallAddress = config.contracts?.multicall3?.address;

  if (!multicallAddress) {
    const [nativeRaw, erc20Results] = await Promise.all([
      nativeTokens.length
        ? evmClient.getBalance({ address: account as Address })
        : Promise.resolve(0n),
      erc20Calls.length
        ? evmClient.multicall({
            contracts: erc20Calls,
            allowFailure: true,
            batchSize: 0,
          })
        : Promise.resolve([]),
    ]);

    assertBatchAvailable(erc20Results, erc20Calls.length);
    nativeTokens.forEach((token) => {
      balances[getSwapTokenKey(token)] = formatUnits(
        nativeRaw,
        token.decimals,
      );
    });
    erc20Tokens.forEach((token, index) => {
      balances[getSwapTokenKey(token)] = formatUnits(
        readMulticallBalance(erc20Results[index]),
        token.decimals,
      );
    });
    return balances;
  }

  const nativeCall = {
    address: multicallAddress,
    abi: multicall3Abi,
    functionName: 'getEthBalance' as const,
    args: [account as Address] as const,
  };
  const calls = nativeTokens.length
    ? [nativeCall, ...erc20Calls]
    : erc20Calls;
  const results = calls.length
    ? await evmClient.multicall({
        contracts: calls,
        allowFailure: true,
        batchSize: 0,
      })
    : [];

  assertBatchAvailable(results, calls.length);
  const erc20Offset = nativeTokens.length ? 1 : 0;
  if (nativeTokens.length) {
    const nativeRaw = readMulticallBalance(results[0]);
    nativeTokens.forEach((token) => {
      balances[getSwapTokenKey(token)] = formatUnits(
        nativeRaw,
        token.decimals,
      );
    });
  }
  erc20Tokens.forEach((token, index) => {
    balances[getSwapTokenKey(token)] = formatUnits(
      readMulticallBalance(results[index + erc20Offset]),
      token.decimals,
    );
  });

  return balances;
};

export const fetchSolanaSwapBalances = async ({
  chain,
  account,
  tokens = getSwapTokensForChain(chain),
  solanaConnection: connection = solanaConnection,
}: Omit<FetchSwapChainBalancesParams, 'evmClient'>) => {
  const balances: SwapTokenBalanceMap = Object.fromEntries(
    tokens.map((token) => [getSwapTokenKey(token), '0']),
  );
  const nativeTokens = tokens.filter(isNativeToken);
  const splTokens = tokens.filter((token) => !isNativeToken(token));
  const owner = new PublicKey(account);

  const [lamports, tokenAccounts] = await Promise.all([
    nativeTokens.length ? connection.getBalance(owner) : Promise.resolve(0),
    splTokens.length
      ? connection.getParsedTokenAccountsByOwner(owner, {
          programId: SOLANA_TOKEN_PROGRAM_ID,
        })
      : Promise.resolve({ value: [] }),
  ]);

  const rawBalancesByMint = new Map<string, bigint>();
  tokenAccounts.value.forEach(({ account: tokenAccount }) => {
    const data = tokenAccount.data as ParsedAccountData;
    const mint = data.parsed?.info?.mint as string | undefined;
    const rawAmount = data.parsed?.info?.tokenAmount?.amount as
      | string
      | undefined;
    if (!mint || !rawAmount || !/^\d+$/.test(rawAmount)) return;

    rawBalancesByMint.set(
      mint,
      (rawBalancesByMint.get(mint) ?? 0n) + BigInt(rawAmount),
    );
  });

  nativeTokens.forEach((token) => {
    balances[getSwapTokenKey(token)] = formatUnits(
      BigInt(lamports),
      token.decimals,
    );
  });
  splTokens.forEach((token) => {
    balances[getSwapTokenKey(token)] = formatUnits(
      rawBalancesByMint.get(token.address) ?? 0n,
      token.decimals,
    );
  });

  return balances;
};

export const fetchSwapChainBalances = ({
  chain,
  ...parameters
}: FetchSwapChainBalancesParams) => {
  if (isSolanaChain(chain)) {
    return fetchSolanaSwapBalances({ chain, ...parameters });
  }

  return fetchEvmSwapBalances({ chain, ...parameters });
};

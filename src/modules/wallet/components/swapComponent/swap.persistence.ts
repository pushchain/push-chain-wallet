import type { SwapExecutionRecord } from '../../../../context/SwapTransactionContext';
import type { SwapActivityToken } from './swap.activity';
import { normalizePositiveNetworkCost } from './swap.gas';
import type { SwapTransactionRef } from './swap.types';

export const SWAP_EXECUTION_STORAGE_KEY =
  'push-wallet:successful-swap-executions';
export const SWAP_EXECUTION_STORAGE_VERSION = 1;
export const SWAP_EXECUTION_STORAGE_LIMIT = 50;
export const SWAP_EXECUTION_STORAGE_TTL_MS = 90 * 24 * 60 * 60 * 1_000;

type SwapExecutionStorageEnvelope = {
  version: typeof SWAP_EXECUTION_STORAGE_VERSION;
  records: unknown[];
};

type SwapExecutionStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

type PersistenceOptions = {
  storage?: SwapExecutionStorage | null;
  now?: number;
};

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TRANSACTION_HASH = /^[a-zA-Z0-9]+$/;
const SWAP_TRANSACTION_PHASES = new Set<SwapTransactionRef['phase']>([
  'source',
  'push',
  'destination',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const cleanString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const optionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  return cleanString(value);
};

const getBrowserStorage = (): SwapExecutionStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const sanitizeToken = (value: unknown): SwapActivityToken | null => {
  if (!isRecord(value)) return null;

  const address = cleanString(value.address);
  const symbol = cleanString(value.symbol);
  const amount = cleanString(value.amount);
  if (address === undefined || !symbol || !amount) return null;

  const chain = optionalString(value.chain);
  const chainName = optionalString(value.chainName);
  const name = optionalString(value.name);
  const tokenId = optionalString(value.tokenId);
  const decimals =
    typeof value.decimals === 'number' &&
    Number.isInteger(value.decimals) &&
    value.decimals >= 0
      ? value.decimals
      : undefined;

  return {
    address,
    symbol,
    amount,
    ...(chain ? { chain } : {}),
    ...(chainName ? { chainName } : {}),
    ...(name ? { name } : {}),
    ...(decimals !== undefined ? { decimals } : {}),
    ...(tokenId ? { tokenId } : {}),
  };
};

const sanitizeTokens = (value: unknown): SwapActivityToken[] | null => {
  if (!Array.isArray(value) || !value.length) return null;

  const tokens = value.map(sanitizeToken);
  return tokens.every((token): token is SwapActivityToken => !!token)
    ? tokens
    : null;
};

const sanitizeTransactionRef = (
  value: unknown,
): SwapTransactionRef | null => {
  if (!isRecord(value)) return null;

  const phase = cleanString(value.phase) as SwapTransactionRef['phase'];
  const chainId = cleanString(value.chainId);
  const hash = cleanString(value.hash);
  const explorerUrl = optionalString(value.explorerUrl);
  if (
    !SWAP_TRANSACTION_PHASES.has(phase) ||
    !chainId ||
    !hash ||
    !TRANSACTION_HASH.test(hash)
  ) {
    return null;
  }

  return {
    phase,
    chainId,
    hash,
    ...(explorerUrl ? { explorerUrl } : {}),
  };
};

const sanitizeTransactionRefs = (
  value: unknown,
): SwapTransactionRef[] | null => {
  if (!Array.isArray(value)) return null;

  const refs = value.map(sanitizeTransactionRef);
  return refs.every((ref): ref is SwapTransactionRef => !!ref) ? refs : null;
};

const sanitizeSuccessfulSwapExecution = (
  value: unknown,
  now: number,
): SwapExecutionRecord | null => {
  if (!isRecord(value)) return null;

  const executionId = cleanString(value.executionId);
  const executorAddress = cleanString(value.executorAddress);
  const hash = cleanString(value.hash);
  const tokensIn = sanitizeTokens(value.tokensIn);
  const tokensOut = sanitizeTokens(value.tokensOut);
  const transactionRefs = sanitizeTransactionRefs(value.transactionRefs);
  const timestamp =
    typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
      ? Math.trunc(value.timestamp)
      : null;

  if (
    !executionId ||
    !executorAddress ||
    !EVM_ADDRESS.test(executorAddress) ||
    !hash ||
    !TRANSACTION_HASH.test(hash) ||
    value.type !== 'swap' ||
    value.status !== 'success' ||
    timestamp === null ||
    timestamp <= now - SWAP_EXECUTION_STORAGE_TTL_MS ||
    timestamp > now ||
    !tokensIn ||
    !tokensOut ||
    !transactionRefs
  ) {
    return null;
  }

  const sourceChain = optionalString(value.sourceChain);
  const destinationChain = optionalString(value.destinationChain);
  const sourceAddress = optionalString(value.sourceAddress);
  const destinationAddress = optionalString(value.destinationAddress);
  const networkCost = normalizePositiveNetworkCost(value.networkCost);
  const submittedHash = optionalString(value.submittedHash);
  const submittedChain = optionalString(value.submittedChain);
  const trackUrl = optionalString(value.trackUrl);
  const explorerHash = optionalString(value.explorerHash);
  const explorerUrl = optionalString(value.explorerUrl);

  return {
    executionId,
    executorAddress,
    hash,
    type: 'swap',
    status: 'success',
    timestamp,
    tokensIn,
    tokensOut,
    transactionRefs,
    ...(sourceChain ? { sourceChain } : {}),
    ...(destinationChain ? { destinationChain } : {}),
    ...(sourceAddress ? { sourceAddress } : {}),
    ...(destinationAddress ? { destinationAddress } : {}),
    ...(networkCost ? { networkCost } : {}),
    ...(submittedHash ? { submittedHash } : {}),
    ...(submittedChain ? { submittedChain } : {}),
    ...(trackUrl ? { trackUrl } : {}),
    ...(explorerHash ? { explorerHash } : {}),
    ...(explorerUrl ? { explorerUrl } : {}),
    recordSource: 'local',
  };
};

const normalizeSuccessfulSwapExecutions = (
  values: readonly unknown[],
  now: number,
) => {
  const recordsByHash = new Map<string, SwapExecutionRecord>();

  values.forEach((value) => {
    const record = sanitizeSuccessfulSwapExecution(value, now);
    if (!record) return;

    const key = record.hash.toLowerCase();
    const existing = recordsByHash.get(key);
    if (!existing || record.timestamp > existing.timestamp) {
      recordsByHash.set(key, record);
    }
  });

  return [...recordsByHash.values()]
    .sort(
      (left, right) =>
        right.timestamp - left.timestamp ||
        left.hash.toLowerCase().localeCompare(right.hash.toLowerCase()),
    )
    .slice(0, SWAP_EXECUTION_STORAGE_LIMIT);
};

export const loadPersistedSwapExecutions = (
  options: PersistenceOptions = {},
): SwapExecutionRecord[] => {
  const storage =
    'storage' in options ? options.storage : getBrowserStorage();
  const now = options.now ?? Date.now();
  if (!storage) return [];

  try {
    const serialized = storage.getItem(SWAP_EXECUTION_STORAGE_KEY);
    if (!serialized) return [];

    const parsed = JSON.parse(serialized) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== SWAP_EXECUTION_STORAGE_VERSION ||
      !Array.isArray(parsed.records)
    ) {
      return [];
    }

    return normalizeSuccessfulSwapExecutions(parsed.records, now);
  } catch {
    return [];
  }
};

export const persistSuccessfulSwapExecutions = (
  records: readonly SwapExecutionRecord[],
  options: PersistenceOptions = {},
) => {
  const storage =
    'storage' in options ? options.storage : getBrowserStorage();
  const now = options.now ?? Date.now();
  if (!storage) return;

  try {
    const sanitizedRecords = normalizeSuccessfulSwapExecutions(records, now);
    if (!sanitizedRecords.length) {
      storage.removeItem(SWAP_EXECUTION_STORAGE_KEY);
      return;
    }

    const envelope: SwapExecutionStorageEnvelope = {
      version: SWAP_EXECUTION_STORAGE_VERSION,
      records: sanitizedRecords,
    };
    storage.setItem(SWAP_EXECUTION_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Persistence must never interrupt a swap or dashboard rendering.
  }
};

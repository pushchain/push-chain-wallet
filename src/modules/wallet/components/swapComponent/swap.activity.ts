import type {
  SwapFailureDetails,
  SwapTransactionRef,
} from './swap.types';
import { PUSH_CHAIN_ID } from './swap.constants';
import { normalizePositiveNetworkCost } from './swap.gas';

export const PUSH_CHAIN_EXPLORER_URL = 'https://donut.push.network';

export type SwapActivityType =
  | 'swap'
  | 'cross_chain_deposit'
  | 'cross_chain_withdrawal';

export type SwapActivityStatus = 'pending' | 'success' | 'failed';

export type SwapActivityToken = {
  address: string;
  symbol: string;
  amount: string;
  chain?: string;
  chainName?: string;
  name?: string;
  decimals?: number;
  tokenId?: string;
};

export type SwapActivityRecord = {
  hash: string;
  type: SwapActivityType;
  status: SwapActivityStatus;
  timestamp: number;
  tokensIn: SwapActivityToken[];
  tokensOut: SwapActivityToken[];
  sourceChain?: string;
  destinationChain?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  networkCost?: string;
  submittedHash?: string;
  submittedChain?: string;
  trackUrl?: string;
  explorerHash?: string;
  explorerUrl?: string;
  error?: string;
  failure?: SwapFailureDetails;
  recordSource?: 'local' | 'remote';
  transactionRefs?: SwapTransactionRef[];
};

export type RamenActivityToken = {
  address: string;
  symbol: string;
  amount: string;
  tokenId?: string;
  chainId?: string;
  chainName?: string;
};

export type RamenActivity = {
  hash: string;
  type:
    | SwapActivityType
    | 'add_liquidity'
    | 'remove_liquidity'
    | 'transfer'
    | 'failed';
  status: 'success' | 'failed';
  user: string;
  tokensIn?: RamenActivityToken[];
  tokensOut?: RamenActivityToken[];
  networkCost?: string;
  timestamp: number | string;
  sourceChain?: string;
  destinationChain?: string;
  sourceAddress?: string;
  destinationAddress?: string;
};

export type RamenActivityApiSuccess = {
  success: true;
  address: string;
  page: number;
  limit: number;
  hasMore: boolean;
  totalItems: number;
  totalPages: number;
  activities: RamenActivity[];
};

export type RamenActivityApiError = {
  success: false;
  error: string;
  code?: string;
};

export type RamenActivityApiResponse =
  | RamenActivityApiSuccess
  | RamenActivityApiError;

export type ActivityTimestamp = number | string | Date | null | undefined;

export type SwapActivityDateOptions = {
  locale?: string | string[];
  timeZone?: string;
};

export type SwapActivityDateGroup = {
  key: string;
  label: string;
  activities: SwapActivityRecord[];
};

const SUPPORTED_RAMEN_ACTIVITY_TYPES = new Set<SwapActivityType>([
  'swap',
  'cross_chain_deposit',
  'cross_chain_withdrawal',
]);

const cleanString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = cleanString(value);
    if (normalized) return normalized;
  }

  return undefined;
};

/**
 * Normalizes the timestamp formats used by the Ramen API (epoch seconds) and
 * the Push explorer (ISO strings) to epoch milliseconds.
 */
export const normalizeActivityTimestamp = (
  timestamp: ActivityTimestamp,
): number | null => {
  if (timestamp instanceof Date) {
    const value = timestamp.getTime();
    return Number.isFinite(value) ? value : null;
  }

  if (typeof timestamp === 'string') {
    const normalized = timestamp.trim();
    if (!normalized) return null;

    if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
      return normalizeActivityTimestamp(Number(normalized));
    }

    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }

  // Current epoch milliseconds are 13 digits. Ramen returns epoch seconds.
  return Math.abs(timestamp) < 1_000_000_000_000
    ? Math.trunc(timestamp * 1_000)
    : Math.trunc(timestamp);
};

export const normalizeTransactionHash = (hash: unknown): string | null => {
  const normalized = cleanString(hash);
  if (!normalized || !/^[a-zA-Z0-9]+$/.test(normalized)) return null;

  return normalized;
};

/**
 * Returns every transaction hash known to identify a swap operation. A
 * cross-chain swap can be represented by different source, Push, and
 * destination hashes, so consumers must not rely on the canonical hash alone.
 */
export const getSwapActivityIdentityHashes = (
  record: Pick<
    SwapActivityRecord,
    'hash' | 'submittedHash' | 'explorerHash' | 'transactionRefs'
  >,
): string[] => {
  const hashes = [
    record.hash,
    record.submittedHash,
    record.explorerHash,
    ...(record.transactionRefs ?? []).map((transaction) => transaction.hash),
  ];
  const normalizedHashes = new Set<string>();

  hashes.forEach((hash) => {
    const normalized = normalizeTransactionHash(hash);
    if (normalized) normalizedHashes.add(normalized.toLowerCase());
  });

  return [...normalizedHashes];
};

const normalizeCaipChain = (chain: unknown): string | null => {
  const normalized = cleanString(chain);
  if (
    !normalized ||
    !/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
};

const normalizeExplorerBaseUrl = (baseUrl: string) =>
  baseUrl.trim().replace(/\/+$/, '');

export const buildSwapTrackingUrl = (
  sourceChain: string | null | undefined,
  submittedHash: string | null | undefined,
  explorerBaseUrl = PUSH_CHAIN_EXPLORER_URL,
): string | null => {
  const chain = normalizeCaipChain(sourceChain);
  const hash = normalizeTransactionHash(submittedHash);
  const baseUrl = normalizeExplorerBaseUrl(explorerBaseUrl);

  if (!chain || !hash || !baseUrl) return null;

  const universalTransaction =
    chain.toLowerCase() === PUSH_CHAIN_ID.toLowerCase()
      ? hash
      : `${chain}:${hash}`;

  return `${baseUrl}/track?utx=${universalTransaction}`;
};

export const buildPushTransactionExplorerUrl = (
  hash: string | null | undefined,
  explorerBaseUrl = PUSH_CHAIN_EXPLORER_URL,
): string | null => {
  const normalizedHash = normalizeTransactionHash(hash);
  const baseUrl = normalizeExplorerBaseUrl(explorerBaseUrl);

  if (!normalizedHash || !baseUrl) return null;

  return `${baseUrl}/tx/${normalizedHash}`;
};

export const shortenTransactionHash = (
  hash: string | null | undefined,
  leadingCharacters = 8,
  trailingCharacters = 8,
) => {
  const normalizedHash = normalizeTransactionHash(hash);
  if (!normalizedHash) return '—';

  const leading = Math.max(0, Math.trunc(leadingCharacters));
  const trailing = Math.max(0, Math.trunc(trailingCharacters));

  if (
    !leading ||
    !trailing ||
    normalizedHash.length <= leading + trailing + 1
  ) {
    return normalizedHash;
  }

  return `${normalizedHash.slice(0, leading)}…${normalizedHash.slice(
    -trailing,
  )}`;
};

const normalizeRamenToken = (
  token: RamenActivityToken,
  fallbackChain?: string,
): SwapActivityToken | null => {
  const symbol = cleanString(token.symbol);
  const amount = cleanString(token.amount);

  if (!symbol || !amount) return null;

  return {
    address: cleanString(token.address) ?? '',
    symbol,
    amount,
    ...(firstString(token.chainId, fallbackChain)
      ? { chain: firstString(token.chainId, fallbackChain) }
      : {}),
    ...(cleanString(token.chainName)
      ? { chainName: cleanString(token.chainName) }
      : {}),
    ...(cleanString(token.tokenId)
      ? { tokenId: cleanString(token.tokenId) }
      : {}),
  };
};

/**
 * Converts Ramen's activity response to the stable record consumed by the
 * wallet. Non-swap activity and incomplete token pairs are intentionally
 * excluded so generic wallet activity can continue to render those entries.
 */
export const normalizeRamenSwapActivity = (
  activity: RamenActivity,
): SwapActivityRecord | null => {
  if (
    !SUPPORTED_RAMEN_ACTIVITY_TYPES.has(
      activity.type as SwapActivityType,
    )
  ) {
    return null;
  }

  const hash = normalizeTransactionHash(activity.hash);
  const timestamp = normalizeActivityTimestamp(activity.timestamp);
  if (!hash || timestamp === null) return null;

  const sourceChain = firstString(
    activity.sourceChain,
    activity.tokensIn?.[0]?.chainId,
  );
  const destinationChain = firstString(
    activity.destinationChain,
    activity.tokensOut?.[0]?.chainId,
  );
  const tokensIn = (activity.tokensIn ?? [])
    .map((token) => normalizeRamenToken(token, sourceChain))
    .filter((token): token is SwapActivityToken => !!token);
  const tokensOut = (activity.tokensOut ?? [])
    .map((token) => normalizeRamenToken(token, destinationChain))
    .filter((token): token is SwapActivityToken => !!token);

  if (!tokensIn.length || !tokensOut.length) return null;

  const explorerUrl = buildPushTransactionExplorerUrl(hash);
  const networkCost = normalizePositiveNetworkCost(
    activity.networkCost,
  );

  return {
    hash,
    type: activity.type as SwapActivityType,
    status: activity.status,
    timestamp,
    tokensIn,
    tokensOut,
    ...(sourceChain ? { sourceChain } : {}),
    ...(destinationChain ? { destinationChain } : {}),
    ...(cleanString(activity.sourceAddress)
      ? { sourceAddress: cleanString(activity.sourceAddress) }
      : {}),
    ...(cleanString(activity.destinationAddress)
      ? { destinationAddress: cleanString(activity.destinationAddress) }
      : {}),
    ...(networkCost ? { networkCost } : {}),
    explorerHash: hash,
    ...(explorerUrl ? { explorerUrl } : {}),
    recordSource: 'remote',
  };
};

const tokenIdentityMatches = (
  primary: SwapActivityToken,
  fallback: SwapActivityToken,
) => {
  const primaryAddress = primary.address.trim().toLowerCase();
  const fallbackAddress = fallback.address.trim().toLowerCase();

  if (
    primaryAddress &&
    fallbackAddress &&
    primaryAddress === fallbackAddress
  ) {
    return true;
  }

  if (primary.symbol.toLowerCase() !== fallback.symbol.toLowerCase()) {
    return false;
  }

  return (
    !primary.chain ||
    !fallback.chain ||
    primary.chain.toLowerCase() === fallback.chain.toLowerCase()
  );
};

const mergeToken = (
  primary: SwapActivityToken,
  fallback: SwapActivityToken,
): SwapActivityToken => ({
  ...fallback,
  ...primary,
  address: firstString(primary.address, fallback.address) ?? '',
  symbol: firstString(primary.symbol, fallback.symbol) ?? '',
  amount: firstString(primary.amount, fallback.amount) ?? '0',
  chain: firstString(primary.chain, fallback.chain),
  chainName: firstString(primary.chainName, fallback.chainName),
  name: firstString(primary.name, fallback.name),
  decimals: primary.decimals ?? fallback.decimals,
  tokenId: firstString(primary.tokenId, fallback.tokenId),
});

const mergeTokenLists = (
  primaryTokens: readonly SwapActivityToken[],
  fallbackTokens: readonly SwapActivityToken[],
  preferFallbackPresentation = false,
) => {
  if (!primaryTokens.length) return fallbackTokens.map((token) => ({ ...token }));
  if (!fallbackTokens.length) return primaryTokens.map((token) => ({ ...token }));

  const usedFallbackIndexes = new Set<number>();
  const merged = primaryTokens.map((primaryToken, primaryIndex) => {
    let fallbackIndex = fallbackTokens.findIndex(
      (fallbackToken, index) =>
        !usedFallbackIndexes.has(index) &&
        tokenIdentityMatches(primaryToken, fallbackToken),
    );

    if (
      fallbackIndex === -1 &&
      primaryIndex < fallbackTokens.length &&
      !usedFallbackIndexes.has(primaryIndex)
    ) {
      fallbackIndex = primaryIndex;
    }

    if (fallbackIndex === -1) return { ...primaryToken };

    usedFallbackIndexes.add(fallbackIndex);
    const fallbackToken = fallbackTokens[fallbackIndex];
    const mergedToken = mergeToken(primaryToken, fallbackToken);

    if (!preferFallbackPresentation) return mergedToken;

    return {
      ...mergedToken,
      address: firstString(fallbackToken.address, mergedToken.address) ?? '',
      symbol: firstString(fallbackToken.symbol, mergedToken.symbol) ?? '',
      chain: firstString(fallbackToken.chain, mergedToken.chain),
      chainName: firstString(fallbackToken.chainName, mergedToken.chainName),
      name: firstString(fallbackToken.name, mergedToken.name),
      decimals: fallbackToken.decimals ?? mergedToken.decimals,
      tokenId: firstString(fallbackToken.tokenId, mergedToken.tokenId),
    };
  });

  fallbackTokens.forEach((token, index) => {
    if (!usedFallbackIndexes.has(index)) merged.push({ ...token });
  });

  return merged;
};

const mergeTransactionRefs = (
  primaryRefs: readonly SwapTransactionRef[] = [],
  fallbackRefs: readonly SwapTransactionRef[] = [],
) => {
  const refsByIdentity = new Map<string, SwapTransactionRef>();

  [...primaryRefs, ...fallbackRefs].forEach((transaction) => {
    const hash = normalizeTransactionHash(transaction.hash);
    const chainId = cleanString(transaction.chainId);
    if (!hash || !chainId) return;

    const key = [
      transaction.phase,
      chainId.toLowerCase(),
      hash.toLowerCase(),
    ].join(':');
    if (!refsByIdentity.has(key)) {
      refsByIdentity.set(key, { ...transaction });
    }
  });

  return [...refsByIdentity.values()];
};

const mergeRecordWithFallback = (
  primary: SwapActivityRecord,
  fallback: SwapActivityRecord,
): SwapActivityRecord => {
  const preserveSelectedRoute = fallback.recordSource === 'local';
  const transactionRefs = mergeTransactionRefs(
    primary.transactionRefs,
    fallback.transactionRefs,
  );

  return {
    ...fallback,
    ...primary,
    hash: firstString(primary.hash, fallback.hash) ?? '',
    timestamp: Number.isFinite(primary.timestamp)
      ? primary.timestamp
      : fallback.timestamp,
    tokensIn: mergeTokenLists(
      primary.tokensIn,
      fallback.tokensIn,
      preserveSelectedRoute,
    ),
    tokensOut: mergeTokenLists(
      primary.tokensOut,
      fallback.tokensOut,
      preserveSelectedRoute,
    ),
    sourceChain: preserveSelectedRoute
      ? firstString(fallback.sourceChain, primary.sourceChain)
      : firstString(primary.sourceChain, fallback.sourceChain),
    destinationChain: preserveSelectedRoute
      ? firstString(fallback.destinationChain, primary.destinationChain)
      : firstString(primary.destinationChain, fallback.destinationChain),
    sourceAddress: firstString(primary.sourceAddress, fallback.sourceAddress),
    destinationAddress: firstString(
      primary.destinationAddress,
      fallback.destinationAddress,
    ),
    networkCost:
      normalizePositiveNetworkCost(primary.networkCost) ??
      normalizePositiveNetworkCost(fallback.networkCost),
    submittedHash: firstString(primary.submittedHash, fallback.submittedHash),
    submittedChain: firstString(
      primary.submittedChain,
      fallback.submittedChain,
    ),
    trackUrl: firstString(primary.trackUrl, fallback.trackUrl),
    explorerHash: firstString(primary.explorerHash, fallback.explorerHash),
    explorerUrl: firstString(primary.explorerUrl, fallback.explorerUrl),
    error:
      primary.status === 'failed'
        ? firstString(primary.error, fallback.error)
        : undefined,
    ...(transactionRefs.length ? { transactionRefs } : {}),
  };
};

const sortSwapActivityRecords = (
  records: readonly SwapActivityRecord[],
) =>
  [...records].sort(
    (left, right) =>
      right.timestamp - left.timestamp ||
      left.hash.toLowerCase().localeCompare(right.hash.toLowerCase()),
  );

/**
 * Merges the parsed Ramen feed with optimistic/local records. Records belong
 * to the same operation when any known source, Push, or destination hash
 * overlaps. Remote chain data wins while locally known submission/tracking
 * and token metadata fill any gaps.
 */
export const mergeSwapActivityRecords = (
  remoteRecords: readonly SwapActivityRecord[],
  localRecords: readonly SwapActivityRecord[] = [],
) => {
  type ActivityCluster = {
    record: SwapActivityRecord;
    identityHashes: Set<string>;
  };

  const clusters: ActivityCluster[] = [];
  const addRecord = (
    record: SwapActivityRecord,
    recordSource: 'local' | 'remote',
  ) => {
    const identityHashes = new Set(getSwapActivityIdentityHashes(record));
    if (!identityHashes.size) return;

    const matchingIndexes: number[] = [];
    clusters.forEach((cluster, index) => {
      if (
        [...identityHashes].some((hash) =>
          cluster.identityHashes.has(hash),
        )
      ) {
        matchingIndexes.push(index);
      }
    });

    let mergedRecord = { ...record };
    const mergedIdentityHashes = new Set(identityHashes);

    matchingIndexes.forEach((index) => {
      const cluster = clusters[index];
      mergedRecord = mergeRecordWithFallback(
        mergedRecord,
        cluster.record,
      );
      cluster.identityHashes.forEach((hash) =>
        mergedIdentityHashes.add(hash),
      );
    });

    if (recordSource === 'remote') {
      mergedRecord.recordSource = 'remote';
    }

    matchingIndexes
      .sort((left, right) => right - left)
      .forEach((index) => clusters.splice(index, 1));
    clusters.push({
      record: mergedRecord,
      identityHashes: mergedIdentityHashes,
    });
  };

  localRecords.forEach((record) => addRecord(record, 'local'));
  remoteRecords.forEach((record) => addRecord(record, 'remote'));

  return sortSwapActivityRecords(
    clusters.map((cluster) => cluster.record),
  );
};

const getCalendarParts = (
  timestamp: ActivityTimestamp,
  timeZone?: string,
) => {
  const normalizedTimestamp = normalizeActivityTimestamp(timestamp);
  if (normalizedTimestamp === null) return null;

  const date = new Date(normalizedTimestamp);
  if (!timeZone) {
    return {
      year: String(date.getFullYear()).padStart(4, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0'),
    };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  return year && month && day ? { year, month, day } : null;
};

export const getSwapActivityDateKey = (
  timestamp: ActivityTimestamp,
  options: Pick<SwapActivityDateOptions, 'timeZone'> = {},
) => {
  const parts = getCalendarParts(timestamp, options.timeZone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
};

export const formatSwapActivityDateLabel = (
  timestamp: ActivityTimestamp,
  options: SwapActivityDateOptions = {},
) => {
  const normalizedTimestamp = normalizeActivityTimestamp(timestamp);
  if (normalizedTimestamp === null) return 'Unknown date';

  return new Intl.DateTimeFormat(options.locale ?? 'en-US', {
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(normalizedTimestamp));
};

export const groupSwapActivityRecordsByDate = (
  records: readonly SwapActivityRecord[],
  options: SwapActivityDateOptions = {},
): SwapActivityDateGroup[] => {
  const groups = new Map<string, SwapActivityDateGroup>();

  sortSwapActivityRecords(records).forEach((record) => {
    const key =
      getSwapActivityDateKey(record.timestamp, options) ?? 'unknown-date';
    const existing = groups.get(key);

    if (existing) {
      existing.activities.push(record);
      return;
    }

    groups.set(key, {
      key,
      label: formatSwapActivityDateLabel(record.timestamp, options),
      activities: [record],
    });
  });

  return [...groups.values()];
};

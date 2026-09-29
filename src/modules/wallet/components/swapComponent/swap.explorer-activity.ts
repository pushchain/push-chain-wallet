import { formatUnits } from 'viem';
import { PRC20_TOKENS } from '../../../../constants';
import type {
  WalletActivitiesResponse,
  WalletActivityTokenTransfer,
} from '../../../../types/walletactivities.types';
import {
  buildPushTransactionExplorerUrl,
  normalizeActivityTimestamp,
  normalizeTransactionHash,
  type SwapActivityRecord,
  type SwapActivityToken,
} from './swap.activity';
import { PUSH_CHAIN_ID } from './swap.constants';
import { normalizePositiveNetworkCost } from './swap.gas';

const EVM_ADDRESS = /0x[0-9a-fA-F]{40}$/;

const normalizeAddress = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  const evmAddress = trimmed.match(EVM_ADDRESS)?.[0];
  return (evmAddress ?? trimmed).toLowerCase();
};

const isTrackedAddress = (
  trackedAddresses: readonly string[],
  value?: string | null,
) => {
  const normalized = normalizeAddress(value);
  return (
    !!normalized &&
    trackedAddresses.some(
      (address) => normalizeAddress(address) === normalized,
    )
  );
};

const normalizeDecimals = (value?: string | number | null) => {
  const decimals = Number(value);
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 255
    ? decimals
    : 18;
};

const formatTransferAmount = (
  transfer: WalletActivityTokenTransfer,
  decimals: number,
) => {
  const rawAmount = String(transfer.total?.value ?? '').trim();
  if (!rawAmount) return null;

  try {
    return /^\d+$/.test(rawAmount)
      ? formatUnits(BigInt(rawAmount), decimals)
      : rawAmount;
  } catch {
    return null;
  }
};

const getPrc20Origin = (address: string) =>
  PRC20_TOKENS.find(
    (token) =>
      token.prc20Address.trim().toLowerCase() === address.toLowerCase(),
  );

const getOriginSymbol = (symbol: string) => {
  if (/^peth(?:\.|$)/i.test(symbol)) return 'ETH';
  if (/^psol(?:\.|$)/i.test(symbol)) return 'SOL';
  if (/^pbnb(?:\.|$)/i.test(symbol)) return 'BNB';
  return symbol.replace(/[._](?:arb|base|bnb|bsc|eth|sol)$/i, '');
};

const normalizeTransferToken = (
  transfer: WalletActivityTokenTransfer,
  direction: 'in' | 'out',
): SwapActivityToken | null => {
  const tokenAddress = transfer.token?.address?.trim() ?? '';
  const symbol = transfer.token?.symbol?.trim();
  if (!tokenAddress || !symbol) return null;

  const decimals = normalizeDecimals(
    transfer.total?.decimals ?? transfer.token?.decimals,
  );
  const amount = formatTransferAmount(transfer, decimals);
  if (!amount) return null;

  const prc20Origin =
    direction === 'out' ? getPrc20Origin(tokenAddress) : undefined;

  return {
    address: tokenAddress,
    symbol: prc20Origin ? getOriginSymbol(symbol) : symbol,
    amount,
    chain: prc20Origin?.sourceChain ?? PUSH_CHAIN_ID,
    ...(transfer.token?.name
      ? { name: transfer.token.name }
      : {}),
    decimals,
  };
};

const getComparableAmount = (token: SwapActivityToken) => {
  const value = Number(token.amount);
  return Number.isFinite(value) ? value : 0;
};

const getPrimaryToken = (
  transfers: readonly WalletActivityTokenTransfer[],
  direction: 'in' | 'out',
) =>
  transfers
    .map((transfer) => normalizeTransferToken(transfer, direction))
    .filter((token): token is SwapActivityToken => !!token)
    .sort(
      (first, second) =>
        getComparableAmount(second) - getComparableAmount(first),
    )[0] ?? null;

const getUnsignedInteger = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
};

const formatNetworkCost = (rawCost: bigint | null) => {
  if (rawCost === null || rawCost <= 0n) return undefined;
  return normalizePositiveNetworkCost(formatUnits(rawCost, 18));
};

const getNetworkCost = (transaction: WalletActivitiesResponse) => {
  const actualFee = formatNetworkCost(
    getUnsignedInteger(transaction.fee?.value),
  );
  if (actualFee) return actualFee;

  const gasUsed = getUnsignedInteger(transaction.gas_used);
  const baseFeePerGas = getUnsignedInteger(
    transaction.base_fee_per_gas,
  );
  if (
    gasUsed === null ||
    gasUsed <= 0n ||
    baseFeePerGas === null ||
    baseFeePerGas <= 0n
  ) {
    return undefined;
  }

  // The EVM envelope is relayed with gasPrice=0. Push's Cosmos fee module
  // still deducts and burns gasUsed * baseFeePerGas from the user's UEA.
  return formatNetworkCost(gasUsed * baseFeePerGas);
};

/**
 * Promotes an explorer transaction only when its receipt contained the
 * canonical pool Swap event. Universal/contract-call labels alone are not a
 * safe signal because sends and arbitrary app calls use the same wrappers.
 */
export const normalizeExplorerSwapActivity = (
  transaction: WalletActivitiesResponse,
  trackedAddresses: readonly string[],
): SwapActivityRecord | null => {
  if (!transaction.has_swap_event || !trackedAddresses.length) return null;

  const status = transaction.status?.toLowerCase();
  if (status === 'error' || status === 'failed' || status === 'reverted') {
    return null;
  }

  const hash = normalizeTransactionHash(transaction.hash);
  const timestamp = normalizeActivityTimestamp(transaction.timestamp);
  if (!hash || timestamp === null) return null;

  const transfers = transaction.token_transfers ?? [];
  const outgoing = transfers.filter(
    (transfer) =>
      isTrackedAddress(trackedAddresses, transfer.from?.hash) &&
      !isTrackedAddress(trackedAddresses, transfer.to?.hash),
  );
  const incoming = transfers.filter(
    (transfer) =>
      isTrackedAddress(trackedAddresses, transfer.to?.hash) &&
      !isTrackedAddress(trackedAddresses, transfer.from?.hash),
  );
  const input = getPrimaryToken(outgoing, 'out');
  const output = getPrimaryToken(incoming, 'in');
  if (!input || !output) return null;

  const explorerUrl = buildPushTransactionExplorerUrl(hash);
  const networkCost = getNetworkCost(transaction);

  return {
    hash,
    type: 'swap',
    status: 'success',
    timestamp,
    tokensIn: [input],
    tokensOut: [output],
    sourceChain: input.chain,
    destinationChain: output.chain,
    explorerHash: hash,
    ...(explorerUrl ? { explorerUrl } : {}),
    ...(networkCost ? { networkCost } : {}),
    transactionRefs: [
      {
        phase: 'push',
        chainId: PUSH_CHAIN_ID,
        hash,
      },
    ],
  };
};

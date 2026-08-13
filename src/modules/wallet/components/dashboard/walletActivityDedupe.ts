import { formatUnits } from 'viem';
import { WalletActivitiesResponse } from '../../../../types/walletactivities.types';
import {
  normalizeActivityTimestamp,
  SwapActivityRecord,
} from '../swapComponent/swap.activity';

const normalizeWalletAddress = (value: string) =>
  (value.match(/0x[0-9a-fA-F]{40}$/)?.[0] ?? value).toLowerCase();

const normalizeTokenSymbol = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[._](?:arb|base|bnb|bsc|eth|sol)$/i, '');

const normalizeTransferAmount = (
  value?: string | number | bigint | null,
  decimals?: string | number | null,
) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    const formatted = /^\d+$/.test(raw)
      ? formatUnits(BigInt(raw), Number(decimals ?? 18))
      : raw;
    const numeric = Number(formatted);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
};

export const isSwapFundingTransaction = (
  transaction: WalletActivitiesResponse,
  swaps: readonly SwapActivityRecord[],
  trackedAddresses: readonly string[],
) => {
  if (!transaction.transaction_types.includes('universal_tx')) return false;

  const timestamp = normalizeActivityTimestamp(transaction.timestamp);
  if (timestamp === null) return false;

  return swaps.some((swap) => {
    const input = swap.tokensIn[0];
    if (!input || Math.abs(timestamp - swap.timestamp) > 15 * 60_000) {
      return false;
    }

    const expectedAmount = Number(input.amount);
    if (!Number.isFinite(expectedAmount)) return false;

    return (transaction.token_transfers ?? []).some((transfer) => {
      const from = transfer.from?.hash;
      const isOutgoing =
        !!from &&
        trackedAddresses.some(
          (address) =>
            normalizeWalletAddress(address) === normalizeWalletAddress(from),
        );
      if (!isOutgoing) return false;

      const amount = normalizeTransferAmount(
        transfer.total?.value,
        transfer.total?.decimals ?? transfer.token?.decimals,
      );
      return (
        amount !== null &&
        Math.abs(amount - expectedAmount) <=
          Math.max(Math.abs(expectedAmount) * 1e-9, 1e-12) &&
        normalizeTokenSymbol(transfer.token?.symbol) ===
          normalizeTokenSymbol(input.symbol)
      );
    });
  });
};

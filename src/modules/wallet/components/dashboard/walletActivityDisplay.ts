import { convertCaipToObject } from '../../Wallet.utils';
import type {
  WalletActivitiesResponse,
  WalletActivityAddress,
  WalletActivityTokenTransfer,
} from '../../../../types/walletactivities.types';

const ZERO_EVM_ADDRESS = /^0x0{40}$/i;

const normalizeActivityAddress = (value?: string | null) => {
  if (!value) return '';

  return convertCaipToObject(value).result.address.toLowerCase();
};

const isTrackedActivityAddress = (
  walletAddresses: readonly string[],
  address?: string | null,
) => {
  const normalizedAddress = normalizeActivityAddress(address);
  if (!normalizedAddress) return false;

  return walletAddresses.some(
    (walletAddress) =>
      normalizeActivityAddress(walletAddress) ===
      normalizedAddress,
  );
};

const getAddressHash = (
  address?: WalletActivityAddress | null,
) => address?.hash ?? '';

const getTransferCounterpartyAddress = (
  transfer: WalletActivityTokenTransfer,
  walletAddresses: readonly string[],
) => {
  const fromAddress = getAddressHash(transfer.from);
  const toAddress = getAddressHash(transfer.to);
  const isFromTracked = isTrackedActivityAddress(
    walletAddresses,
    fromAddress,
  );
  const isToTracked = isTrackedActivityAddress(
    walletAddresses,
    toAddress,
  );

  if (isFromTracked && !isToTracked) return toAddress;
  if (isToTracked && !isFromTracked) return fromAddress;
  return isFromTracked ? toAddress : fromAddress;
};

const isZeroActivityAddress = (address?: string | null) =>
  ZERO_EVM_ADDRESS.test(normalizeActivityAddress(address));

/**
 * Protocol calls often contain both the underlying asset movement and a
 * zero-address mint/burn of a receipt or debt token. The underlying transfer
 * is the useful wallet activity; the accounting token remains available when
 * it is the only transfer involving this wallet.
 */
export const getRelevantActivityTokenTransfer = (
  transaction: WalletActivitiesResponse,
  walletAddresses: readonly string[],
) => {
  const relevantTransfers = (transaction.token_transfers ?? []).filter(
    (transfer) =>
      isTrackedActivityAddress(
        walletAddresses,
        getAddressHash(transfer.from),
      ) ||
      isTrackedActivityAddress(
        walletAddresses,
        getAddressHash(transfer.to),
      ),
  );

  return (
    relevantTransfers.find(
      (transfer) =>
        !isZeroActivityAddress(
          getTransferCounterpartyAddress(transfer, walletAddresses),
        ),
    ) ?? relevantTransfers[0]
  );
};

/**
 * `Token` was previously shown as if it were explorer metadata. Prefer the
 * actual name, then distinguish NFT transfers, and keep an explicit unknown
 * fallback when the contract exposes no usable metadata.
 */
export const getActivityTokenDisplaySymbol = (
  transfer: WalletActivityTokenTransfer,
) => {
  const symbol = transfer.token?.symbol?.trim();
  if (symbol) return symbol;

  const name = transfer.token?.name?.trim();
  if (name) return name;

  const tokenType = transfer.token?.type?.trim().toUpperCase();
  if (tokenType === 'ERC-721' || tokenType === 'ERC-1155') {
    return 'NFT';
  }

  return 'Unknown token';
};

/**
 * Explorer contract names are useful historical metadata, but only when the
 * explorer also confirms the address is verified. App URLs are intentionally
 * not inferred from a contract name or address.
 */
export const getVerifiedActivityAddressName = (
  address?: WalletActivityAddress | null,
) => {
  const name = address?.name?.trim();

  return address?.is_verified === true && name ? name : null;
};

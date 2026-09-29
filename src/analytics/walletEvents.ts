export const WALLET_EVENTS = {
  RECEIVE_CLICKED: 'wallet_receive_clicked',
  FAUCET_CLICKED: 'wallet_faucet_clicked',
  ACTIVITY_TAB_CLICKED: 'wallet_activity_tab_clicked',
  SUB_ACCOUNTS_TAB_CLICKED: 'wallet_sub_accounts_tab_clicked',
  TOKEN_ADDED: 'wallet_token_added',
  SEND_CLICKED: 'wallet_send_clicked',
  SEND_TOKEN_SELECTED: 'wallet_send_token_selected',
  SEND_RECIPIENT_ENTERED: 'wallet_send_recipient_entered',
  SEND_AMOUNT_ENTERED: 'wallet_send_amount_entered',
  SEND_RECIPIENT_CHAIN_SELECTED: 'wallet_send_recipient_chain_selected',
  SEND_CONFIRM_CLICKED: 'wallet_send_confirm_clicked',
  SEND_TRANSACTION_SUBMITTED: 'wallet_send_transaction_submitted',
  SEND_SUCCESSFUL: 'wallet_send_successful',
  SEND_FAILED: 'wallet_send_failed',
  SEND_VIEW_TRANSACTION_CLICKED: 'wallet_send_view_transaction_clicked',
  SWAP_CLICKED: 'wallet_swap_clicked',
  SWAP_REVIEW_CLICKED: 'wallet_swap_review_clicked',
  SWAP_TRANSACTION_SUBMITTED: 'wallet_swap_transaction_submitted',
  SWAP_SUCCESSFUL: 'wallet_swap_successful',
  SWAP_FAILED: 'wallet_swap_failed',
} as const;

export type WalletEventName = typeof WALLET_EVENTS[keyof typeof WALLET_EVENTS];
export type WalletTokenType = 'native' | 'pc' | 'erc20' | 'bridged';

export type WalletEventMetadata = Partial<{
  walletAddress: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenType: WalletTokenType;
  sourceChainId: string;
  destinationChainId: string;
  recipientAddress: string;
  amount: string;
  txHash: string;
  errorMessage: string;
  step: string;
  sourceScreen: string;
}>;

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      parameters?: Record<string, string>,
    ) => void;
  }
}

const SUCCESS_STORAGE_PREFIX = 'push-wallet:tracked-send-success:';
const trackedSuccessHashes = new Set<string>();
const ALLOWED_METADATA_KEYS = new Set<keyof WalletEventMetadata>([
  'walletAddress',
  'tokenSymbol',
  'tokenAddress',
  'tokenType',
  'sourceChainId',
  'destinationChainId',
  'recipientAddress',
  'amount',
  'txHash',
  'errorMessage',
  'step',
  'sourceScreen',
]);

const compactMetadata = (metadata: WalletEventMetadata) =>
  Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) =>
        ALLOWED_METADATA_KEYS.has(key as keyof WalletEventMetadata) &&
        value !== undefined &&
        value !== null &&
        value !== '',
    ),
  ) as WalletEventMetadata;

export const trackWalletEvent = (
  eventName: WalletEventName,
  metadata: WalletEventMetadata = {},
) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  // The runtime allow-list prevents accidental sensitive fields from being
  // forwarded even if an untyped caller bypasses WalletEventMetadata.
  try {
    window.gtag(
      'event',
      eventName,
      compactMetadata(metadata) as Record<string, string>,
    );
  } catch {
    // Analytics must never interrupt a wallet action or transaction flow.
  }
};

export const getSafeWalletErrorMessage = (
  error: unknown,
  fallback = 'Transaction failed',
) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : fallback;

  return message
    .replace(/\b0x[a-fA-F0-9]{64}\b/g, '[redacted]')
    .slice(0, 250);
};

export type SendEventMetadataInput = {
  tokenDetails?: {
    token?: { symbol?: string; address?: string } | null;
    native?: boolean;
    source?: 'push' | 'origin' | 'cea';
    sourceChain?: string;
    sourceWallet?: { chainId?: string } | null;
    chainId?: string;
    moveableToken?: unknown;
  } | null;
  walletAddress?: string | null;
  token?: { symbol?: string; address?: string } | null;
  native?: boolean;
  source?: 'push' | 'origin' | 'cea';
  sourceChainId?: string | null;
  fallbackSourceChainId?: string | null;
  destinationChainId?: string | null;
  destinationNetwork?: 'push' | 'associated';
  moveableToken?: unknown;
  recipientAddress?: string | null;
  amount?: string | null;
  txHash?: string | null;
  sourceScreen?: string;
};

export const getWalletTokenType = (
  input: SendEventMetadataInput,
): WalletTokenType | undefined => {
  const hasTokenContext =
    !!input.token ||
    input.native !== undefined ||
    !!input.source ||
    !!input.moveableToken;

  if (!hasTokenContext) return undefined;

  if (
    input.destinationNetwork === 'associated' ||
    input.source === 'origin' ||
    input.source === 'cea' ||
    input.moveableToken
  ) return 'bridged';

  if (input.native || !input.token?.address) return 'native';
  if (input.token.symbol?.toUpperCase() === 'PC') return 'pc';
  return 'erc20';
};

export const buildSendEventMetadata = (
  input: SendEventMetadataInput,
): WalletEventMetadata => {
  const details = input.tokenDetails;
  const normalizedInput: SendEventMetadataInput = {
    ...input,
    token: input.token ?? details?.token,
    native: input.native ?? details?.native,
    source: input.source ?? details?.source,
    sourceChainId:
      input.sourceChainId ??
      details?.sourceChain?.split(':')[1] ??
      details?.sourceWallet?.chainId ??
      details?.chainId ??
      input.fallbackSourceChainId,
    moveableToken: input.moveableToken ?? details?.moveableToken,
  };

  return {
    walletAddress: normalizedInput.walletAddress ?? undefined,
    tokenSymbol: normalizedInput.token?.symbol,
    tokenAddress: normalizedInput.token?.address,
    tokenType: getWalletTokenType(normalizedInput),
    sourceChainId: normalizedInput.sourceChainId ?? undefined,
    destinationChainId: normalizedInput.destinationChainId ?? undefined,
    recipientAddress: normalizedInput.recipientAddress ?? undefined,
    amount: normalizedInput.amount ?? undefined,
    txHash: normalizedInput.txHash ?? undefined,
    sourceScreen: normalizedInput.sourceScreen ?? 'wallet_send',
  };
};

const wasSuccessTracked = (txHash: string) => {
  const normalizedHash = txHash.toLowerCase();
  if (trackedSuccessHashes.has(normalizedHash)) return true;

  try {
    if (sessionStorage.getItem(`${SUCCESS_STORAGE_PREFIX}${normalizedHash}`)) return true;
    sessionStorage.setItem(`${SUCCESS_STORAGE_PREFIX}${normalizedHash}`, '1');
  } catch {
    // In-memory deduplication still works when storage is unavailable.
  }

  trackedSuccessHashes.add(normalizedHash);
  return false;
};

/** Emits the generic success event once per transaction hash. */
export const trackWalletSendSuccess = (input: SendEventMetadataInput) => {
  if (!input.txHash) return false;
  if (wasSuccessTracked(input.txHash)) return false;

  const metadata = buildSendEventMetadata(input);
  trackWalletEvent(WALLET_EVENTS.SEND_SUCCESSFUL, metadata);
  return true;
};

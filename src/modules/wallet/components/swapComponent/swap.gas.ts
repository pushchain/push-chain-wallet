import { formatUnits } from 'viem';

const PC_DECIMALS = 18;
const MIN_DISPLAY_GAS_COST = 0.000001;
const POSITIVE_DECIMAL_VALUE = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Completed swap activity must only retain a measured, positive PC cost.
 * Quote-time values (`~…`/`<…`) and zero-value relayed EVM fees are not
 * completed transaction costs.
 */
export const normalizePositiveNetworkCost = (value: unknown) => {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'bigint'
  ) {
    return undefined;
  }

  const normalized = String(value).trim();
  return POSITIVE_DECIMAL_VALUE.test(normalized) &&
    /[1-9]/.test(normalized)
    ? normalized
    : undefined;
};

export const formatSwapGasCost = (
  gasEstimate: number | undefined,
  gasPriceWei: bigint | undefined,
) => {
  if (
    gasEstimate === undefined ||
    !Number.isSafeInteger(gasEstimate) ||
    gasEstimate <= 0 ||
    gasPriceWei === undefined ||
    gasPriceWei <= 0n
  ) {
    return null;
  }

  const costWei = BigInt(gasEstimate) * gasPriceWei;
  const costInPc = Number(formatUnits(costWei, PC_DECIMALS));

  if (!Number.isFinite(costInPc) || costInPc <= 0) return null;
  if (costInPc < MIN_DISPLAY_GAS_COST) return '<0.000001 PC';

  return `~${costInPc.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} PC`;
};

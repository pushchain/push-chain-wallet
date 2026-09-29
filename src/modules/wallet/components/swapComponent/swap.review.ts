const swapRateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 5,
  useGrouping: false,
});

export const formatSwapReviewRate = ({
  exchangeRate,
  fromSymbol,
  toSymbol,
}: {
  exchangeRate: number;
  fromSymbol: string;
  toSymbol: string;
}) => {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;

  return `1 ${fromSymbol} ≈ ${swapRateFormatter.format(exchangeRate)} ${toSymbol}`;
};

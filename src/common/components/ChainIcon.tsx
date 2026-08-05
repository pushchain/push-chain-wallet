import { DefaultChainMonotone, PushChainLogo } from '../../blocks';
import { CHAIN_LOGO } from '../Common.constants';

const PUSH_CHAIN_IDS = new Set(['9', '9001', '42101', 'devnet']);
const SOLANA_CHAIN_IDS = new Set([
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
  'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
]);

const normalizeChainId = (chainId: string | number | null | undefined) => {
  if (chainId == null) return null;

  const value = String(chainId);
  const [namespace, reference] = value.split(':');
  const normalized =
    (namespace === 'eip155' || namespace === 'solana') && reference
      ? reference
      : value;

  if (/^0x[0-9a-f]+$/i.test(normalized)) {
    return String(Number.parseInt(normalized, 16));
  }

  return normalized;
};

const getChainIcon = (
  chainId: string | number | null | undefined,
  size: number,
) => {
  const resolvedChainId = normalizeChainId(chainId);

  if (resolvedChainId == null || PUSH_CHAIN_IDS.has(resolvedChainId)) {
    return <PushChainLogo width={size} height={size} />;
  }

  const IconComponent = CHAIN_LOGO[resolvedChainId];
  if (IconComponent) {
    if (SOLANA_CHAIN_IDS.has(resolvedChainId)) {
      const artworkSize = Math.max(1, Math.round(size * 0.875));
      return (
        <span
          style={{
            alignItems: 'center',
            display: 'inline-flex',
            flexShrink: 0,
            height: size,
            justifyContent: 'center',
            width: size,
          }}
        >
          <IconComponent width={artworkSize} height={artworkSize} />
        </span>
      );
    }

    return <IconComponent width={size} height={size} />;
  }

  return (
    <DefaultChainMonotone
      size={size}
      color="pw-int-icon-secondary-color"
    />
  );
};

export { getChainIcon, normalizeChainId };

import { DefaultChainMonotone, PushChainLogo } from '../../blocks';
import { CHAIN_LOGO } from '../Common.constants';

const PUSH_CHAIN_IDS = new Set(['9', '9001', '42101', 'devnet']);

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

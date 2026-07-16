import { TOKEN_LISTS } from '../../../../helpers/TokenHelper'
import type { TokenFormat, WalletType } from '../../../../types'

export const tokenMatchesQuery = (
  token: TokenFormat,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [token.name, token.symbol, token.address].some((value) =>
    (value ?? '').toLowerCase().includes(normalizedQuery),
  )
}

export const filterTokensByQuery = (
  tokens: TokenFormat[],
  query: string,
): TokenFormat[] => tokens.filter((token) => tokenMatchesQuery(token, query))

export const getOriginChainTokens = (
  walletDetails: WalletType,
): TokenFormat[] => {
  const chainNamespace = walletDetails.chain?.toLowerCase()
  const chainId = Number(walletDetails.chainId)

  if (chainNamespace === 'solana') return TOKEN_LISTS.SOLANA

  if (chainNamespace === 'eip155' || chainNamespace === 'ethereum') {
    switch (chainId) {
      case 84532:
        return TOKEN_LISTS.BASE
      case 421614:
        return TOKEN_LISTS.ARBITRUM
      case 97:
        return TOKEN_LISTS.BINANCE
      case 11155111:
      default:
        return TOKEN_LISTS.ETHEREUM
    }
  }

  return []
}

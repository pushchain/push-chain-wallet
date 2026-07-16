import { describe, expect, it } from 'vitest'
import type { TokenFormat } from '../../../../types'
import {
  filterTokensByQuery,
  getOriginChainTokens,
  tokenMatchesQuery,
} from './tokenSearch'

const tokens: TokenFormat[] = [
  {
    name: 'Ethereum',
    symbol: 'SepoliaETH',
    address: '',
    decimals: 18,
  },
  {
    name: 'Tether USD',
    symbol: 'USDT',
    address: '0x1111111111111111111111111111111111111111',
    decimals: 6,
  },
]

describe('token search', () => {
  it('matches names and symbols case-insensitively', () => {
    expect(filterTokensByQuery(tokens, 'ethereum')).toEqual([tokens[0]])
    expect(filterTokensByQuery(tokens, 'usdt')).toEqual([tokens[1]])
    expect(tokenMatchesQuery(tokens[0], 'ETHEREUM')).toBe(true)
  })

  it('matches partial token addresses', () => {
    expect(filterTokensByQuery(tokens, '0x1111')).toEqual([tokens[1]])
  })

  it('returns the connected origin chain native token', () => {
    expect(getOriginChainTokens({
      chain: 'eip155',
      chainId: '11155111',
      address: '0x2222222222222222222222222222222222222222',
    })[0]).toMatchObject({ name: 'Ethereum', symbol: 'SepoliaETH' })
  })
})

export type SwapActivityType =
  | 'swap'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'cross_chain_deposit'
  | 'cross_chain_withdrawal'
  | 'transfer'
  | 'failed';

export type SwapActivityStatus = 'success' | 'failed';

export type SwapActivityToken = {
  address: string;
  symbol: string;
  amount: string;
  tokenId?: string;
  chainId?: string;
  chainName?: string;
};

export type SwapActivity = {
  hash: string;
  type: SwapActivityType;
  status: SwapActivityStatus;
  user: string;
  tokensIn?: SwapActivityToken[];
  tokensOut?: SwapActivityToken[];
  networkCost?: string;
  timestamp: number;
  sourceChain?: string;
  destinationChain?: string;
  sourceAddress?: string;
  destinationAddress?: string;
};

export type SwapActivitiesRequest = {
  walletAddress: string;
  page?: number;
  limit?: number;
};

export type SwapActivitiesSuccessResponse = {
  success: true;
  address: string;
  page: number;
  limit: number;
  hasMore: boolean;
  totalItems: number;
  totalPages: number;
  activities: SwapActivity[];
};

export type SwapActivitiesErrorResponse = {
  success: false;
  error: string;
  code?: string;
};

export type SwapActivitiesResponse =
  | SwapActivitiesSuccessResponse
  | SwapActivitiesErrorResponse;

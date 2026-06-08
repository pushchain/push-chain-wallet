import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { SendTokenState, TokenFormat, WalletType } from "../types";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { usePushChain } from "../context/PushChainContext";
import { getAppParamValue, WALLET_TO_APP_ACTION } from "common";
import { useEventEmitterContext } from "./EventEmitterContext";
import {
  ExecuteParams,
  UniversalExecuteParams,
} from "@pushchain/core/src/lib/orchestrator/orchestrator.types";
import { PushChain } from "@pushchain/core";
import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import type { MoveableToken, PushChainMoveableToken } from "@pushchain/core/src/lib/constants";
import { convertCaipToObject, getNativeTokenBalance, getWalletlist } from "../modules/wallet/Wallet.utils";
import { useGlobalState } from "./GlobalContext";
import { TOKEN_LISTS } from "../helpers/TokenHelper";
import { PRC20_TOKENS } from "../constants";

interface SendTokenContextType {
  walletAddress: string;
  sendState: SendTokenState;
  setSendState: (state: SendTokenState) => void;
  receiverAddress: string | null;
  setReceiverAddress: (address: string | null) => void;
  amount: string;
  setAmount: (amount: string) => void;
  sendingTransaction: boolean;
  handleSendTransaction: () => void;
  destinationNetwork: DestinationNetwork;
  setDestinationNetwork: React.Dispatch<React.SetStateAction<DestinationNetwork>>;
  destinationNetworkOptions: DestinationNetworkOption[];
  selectedDestinationNetwork: DestinationNetworkOption;
  canSelectDestinationNetwork: boolean;
  txhash: string | null;
  txError: string,
  setTxhash: React.Dispatch<React.SetStateAction<string>>;
  tokenDetails: TokenDetails;
  setTokenDetails: React.Dispatch<React.SetStateAction<TokenDetails>>;
  nativeBalance: string;
  loadingNativeBalance: boolean;
  nativeToken: TokenFormat | null;
}

export type DestinationNetwork = 'push' | 'associated';

export type DestinationNetworkOption = {
  value: DestinationNetwork;
  label: string;
  chain: CHAIN;
  chainId: string | null;
};

export interface TokenDetails {
  token: TokenFormat | null;
  chainId?: string;
  native: boolean;
  source?: 'push' | 'origin' | 'cea';
  sourceWallet?: WalletType | null;
  sourceChain?: CHAIN;
  moveableToken?: MoveableToken;
}

const PUSH_CHAIN = CHAIN.PUSH_TESTNET_DONUT;
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const PUSH_DESTINATION_OPTION: DestinationNetworkOption = {
  value: 'push',
  label: 'Push Chain',
  chain: PUSH_CHAIN,
  chainId: '42101',
};
const CHAIN_BY_CHAIN_ID: Record<string, CHAIN> = {
  '42101': CHAIN.PUSH_TESTNET_DONUT,
  '11155111': CHAIN.ETHEREUM_SEPOLIA,
  '84532': CHAIN.BASE_SEPOLIA,
  '421614': CHAIN.ARBITRUM_SEPOLIA,
  '97': CHAIN.BNB_TESTNET,
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1: CHAIN.SOLANA_DEVNET,
};
const CHAIN_VALUES = new Set<string>(Object.values(CHAIN));
const CHAIN_LABELS: Partial<Record<CHAIN, string>> = {
  [CHAIN.PUSH_TESTNET_DONUT]: 'Push Chain',
  [CHAIN.ETHEREUM_SEPOLIA]: 'Ethereum Sepolia',
  [CHAIN.BASE_SEPOLIA]: 'Base Sepolia',
  [CHAIN.ARBITRUM_SEPOLIA]: 'Arbitrum Sepolia',
  [CHAIN.BNB_TESTNET]: 'BNB Chain',
  [CHAIN.SOLANA_DEVNET]: 'Solana',
};

type PushMoveableToken = PushChainMoveableToken & {
  chain?: CHAIN;
  chainName?: string;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getChainFromWalletDetails = (walletDetails?: WalletType | null) => {
  if (!walletDetails?.chainId) return undefined;

  const caipChain =
    walletDetails.chain && `${walletDetails.chain}:${walletDetails.chainId}`;

  if (caipChain && CHAIN_VALUES.has(caipChain)) return caipChain as CHAIN;

  return CHAIN_BY_CHAIN_ID[walletDetails.chainId];
};

const isNativeMoveableToken = (token: MoveableToken) =>
  token.mechanism === 'native' ||
  !token.address ||
  token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;

const getChainIdFromChain = (chain?: CHAIN | null) =>
  chain ? chain.split(':')[1] ?? null : null;

const getChainLabel = (chain?: CHAIN | null) =>
  chain ? CHAIN_LABELS[chain] ?? chain : 'Connected Chain';

const isExternalChain = (chain?: CHAIN | null) => !!chain && chain !== PUSH_CHAIN;

const getPrc20TokenConfig = (token?: TokenFormat | null) => {
  if (!token?.address) return undefined;

  const selectedAddress = token.address.trim().toLowerCase();

  return PRC20_TOKENS.find(
    (prcToken) => prcToken.prc20Address.trim().toLowerCase() === selectedAddress,
  );
};

const getFallbackMoveableSymbol = (symbol: string) => {
  if (symbol.startsWith('pETH')) return 'ETH';
  if (symbol.startsWith('pBNB')) return 'BNB';
  if (symbol.startsWith('pSOL')) return 'SOL';

  return symbol.split('.')[0];
};

const getPushMoveableTokenForDetails = (
  details?: TokenDetails | null,
): PushMoveableToken | undefined => {
  const selectedToken = details?.token;

  if (!selectedToken?.address) return undefined;

  const selectedAddress = selectedToken.address.trim().toLowerCase();
  const pushMoveableTokens = PushChain.utils.tokens.getMoveableTokens(PUSH_CHAIN)
    .tokens as PushMoveableToken[];

  const sdkToken = pushMoveableTokens.find((token) => {
    const address = token.address?.trim().toLowerCase();
    const prc20Address = token.prc20Address?.trim().toLowerCase();

    return address === selectedAddress || prc20Address === selectedAddress;
  });

  if (sdkToken) return sdkToken;

  const prc20Token = getPrc20TokenConfig(selectedToken);

  if (!prc20Token || prc20Token.sourceChain === PUSH_CHAIN) return undefined;

  return {
    chain: PUSH_CHAIN,
    symbol: getFallbackMoveableSymbol(prc20Token.symbol),
    decimals: selectedToken.decimals,
    address: selectedToken.address,
    mechanism: 'approve',
    sourceChain: prc20Token.sourceChain,
    prc20Address: selectedToken.address as `0x${string}`,
  };
};

const getMoveableTokenForDetails = (
  details: TokenDetails,
  sourceChain: CHAIN,
) => {
  if (details.moveableToken) return details.moveableToken;

  const moveableTokens = PushChain.utils.tokens.getMoveableTokens(sourceChain)
    .tokens as MoveableToken[];
  const selectedToken = details.token;

  if (!selectedToken?.address) {
    return moveableTokens.find(isNativeMoveableToken);
  }

  const selectedAddress = selectedToken.address.toLowerCase();

  return (
    moveableTokens.find(
      (token) => token.address?.toLowerCase() === selectedAddress,
    ) ??
    moveableTokens.find((token) => token.symbol === selectedToken.symbol)
  );
};

const SendTokenContext = createContext<SendTokenContextType | undefined>(
  undefined
);

export const SendTokenProvider: React.FC<{ children: ReactNode; initialTokenDetails?: TokenDetails }> = ({
  children,
  initialTokenDetails,
}) => {

  const [sendState, setSendState] = useState<SendTokenState>(
    initialTokenDetails ? "selectRecipient" : "selectToken"
  );
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(initialTokenDetails || null);
  const [receiverAddress, setReceiverAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [destinationNetwork, setDestinationNetwork] = useState<DestinationNetwork>('push');

  const [sendingTransaction, setSendingTransaction] = useState<boolean>(false);

  const [txError, setTxError] = useState<string>('');

  const [nativeBalance, setNativeBalance] = useState('0');
  const [loadingNativeBalance, setLoadingNativeBalance] = useState(true);

  const { sendMessageToMainTab, setTxhash, txhash } = useEventEmitterContext();
  const { pushChainClient, executorAddress } = usePushChain();

  const isOpenedInIframe = !!getAppParamValue();

   const { state } = useGlobalState();

  const pushWallet = getWalletlist(state.wallet)[0];
  const readOnlyWallet = state.pushWallet ? PushChain.utils.account.toChainAgnostic(state.pushWallet.address, { chain: state.pushWallet.chain }) : null;
  const parsedWallet = pushWallet?.fullAddress || readOnlyWallet || state?.externalWallet?.originAddress;

  const { result } = useMemo(
    () => convertCaipToObject(parsedWallet),
    [parsedWallet],
  );

  const selectedPrc20MoveableToken = useMemo(
    () => getPushMoveableTokenForDetails(tokenDetails),
    [tokenDetails?.moveableToken, tokenDetails?.token?.address],
  );
  const isSelectedPrc20Token = !!selectedPrc20MoveableToken;
  const associatedDestinationChain = useMemo(
    () =>
      isSelectedPrc20Token && isExternalChain(selectedPrc20MoveableToken.sourceChain)
        ? selectedPrc20MoveableToken.sourceChain
        : null,
    [
      isSelectedPrc20Token,
      selectedPrc20MoveableToken?.sourceChain,
    ],
  );
  const canSelectDestinationNetwork =
    isSelectedPrc20Token &&
    !!associatedDestinationChain;
  const associatedDestinationOption = useMemo<DestinationNetworkOption | null>(() => {
    if (!associatedDestinationChain) return null;

    return {
      value: 'associated',
      label: getChainLabel(associatedDestinationChain),
      chain: associatedDestinationChain,
      chainId: getChainIdFromChain(associatedDestinationChain),
    };
  }, [associatedDestinationChain]);
  const destinationNetworkOptions = useMemo(
    () => [
      PUSH_DESTINATION_OPTION,
      ...(associatedDestinationOption ? [associatedDestinationOption] : []),
    ],
    [associatedDestinationOption],
  );
  const selectedDestinationNetwork =
    destinationNetwork === 'associated' && associatedDestinationOption
      ? associatedDestinationOption
      : PUSH_DESTINATION_OPTION;

  const sendToken = async (token: TokenFormat) => {
    try {

      setSendingTransaction(true);
      setTxError('')
      const value = parseUnits((amount || '0').toString(), token.decimals);

      const encodedData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [receiverAddress as `0x${string}`, value]
      })

      const payload: ExecuteParams = {
        to: token.address as `0x${string}`,
        value: BigInt(0),
        data: encodedData,
      }

      if (isOpenedInIframe) {
        sendMessageToMainTab({
          type: WALLET_TO_APP_ACTION.PUSH_SEND_TRANSACTION,
          data: { ...payload },
        });

        return;
      }

      const receipt = await pushChainClient.universal.sendTransaction(payload);

      if (receipt.finalTxHash) {
        setSendState("confirmation");
        setTxhash(receipt.finalTxHash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending transaction", error);
      setTxError(getErrorMessage(error, 'Transaction failed'))
      setSendingTransaction(false);
    }
  }

  const sendPrc20TokenToAssociatedChain = async () => {
    try {
      if (!selectedPrc20MoveableToken) {
        throw new Error('Unsupported PRC token for associated chain transfer.');
      }

      if (!associatedDestinationChain) {
        throw new Error('Missing associated chain.');
      }

      setSendingTransaction(true);
      setTxError('');

      const value = PushChain.utils.helpers.parseUnits(
        (amount || '0').toString(),
        selectedPrc20MoveableToken.decimals,
      );

      const payload: UniversalExecuteParams = {
        to: {
          address: receiverAddress,
          chain: associatedDestinationChain,
        },
        funds: {
          amount: value,
          token: selectedPrc20MoveableToken,
        },
      };

      if (isOpenedInIframe) {
        sendMessageToMainTab({
          type: WALLET_TO_APP_ACTION.PUSH_SEND_TRANSACTION,
          data: { ...payload, funds: { ...payload.funds, amount: value.toString() } },
        });

        return;
      }

      const receipt = await pushChainClient.universal.sendTransaction(payload);

      if (receipt.finalTxHash) {
        setSendState("confirmation");
        setTxhash(receipt.finalTxHash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending PRC token to associated chain", error);
      setTxError(getErrorMessage(error, 'Transaction failed'))
      setSendingTransaction(false);
    }
  }

  const sendPushNativeToken = async () => {
    try {
      setSendingTransaction(true);
      setTxError('')
      const value = PushChain.utils.helpers.parseUnits((amount || '0').toString(), 18);

      const payload: ExecuteParams = {
        to: receiverAddress as `0x${string}`,
        value: value,
      }

      if (isOpenedInIframe) {
        sendMessageToMainTab({
          type: WALLET_TO_APP_ACTION.PUSH_SEND_TRANSACTION,
          data: { ...payload, value: value.toString() },
        });

        return;
      }

      const receipt = await pushChainClient.universal.sendTransaction(payload);

      if (receipt.finalTxHash) {
        setSendState("confirmation");
        setTxhash(receipt.finalTxHash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending transaction", error);
      setTxError(getErrorMessage(error, 'Transaction failed'))
      setSendingTransaction(false);
    }
  }

  const sendMoveableTokenToPush = async (source: 'origin' | 'cea') => {
    try {
      if (!tokenDetails) {
        throw new Error('Missing token details.');
      }

      const sourceChain =
        tokenDetails.sourceChain ??
        getChainFromWalletDetails(tokenDetails.sourceWallet ?? result);

      if (!sourceChain || sourceChain === PUSH_CHAIN) {
        throw new Error('Missing external source chain.');
      }

      const selectedToken = getMoveableTokenForDetails(
        tokenDetails,
        sourceChain,
      );

      if (!selectedToken) {
        throw new Error('Unsupported moveable token for selected source chain.');
      }

      setSendingTransaction(true);
      setTxError('');

      const value = PushChain.utils.helpers.parseUnits(
        (amount || '0').toString(),
        selectedToken.decimals,
      );

      const payload: UniversalExecuteParams = {
        ...(source === 'cea' ? { from: { chain: sourceChain } } : {}),
        to: receiverAddress as `0x${string}`,
        funds: {
          amount: value,
          token: selectedToken,
        },
      };

      if (isOpenedInIframe) {
        sendMessageToMainTab({
          type: WALLET_TO_APP_ACTION.PUSH_SEND_TRANSACTION,
          data: { ...payload, funds: { ...payload.funds, amount: value.toString() } },
        });

        return;
      }

      const receipt = await pushChainClient.universal.sendTransaction(payload);

      if (receipt.finalTxHash) {
        setSendState("confirmation");
        setTxhash(receipt.finalTxHash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending moveable token transaction", error);
      setTxError(getErrorMessage(error, 'Transaction failed'))
      setSendingTransaction(false);
    }
  }

  const handleSendTransaction = async () => {
    if (destinationNetwork === 'associated') {
      if (!canSelectDestinationNetwork) {
        setTxError('Associated chain transfers are only available for PRC tokens.');
        return;
      }

      if (isSelectedPrc20Token) {
        sendPrc20TokenToAssociatedChain();
        return;
      }
    }

    if (tokenDetails?.source === 'cea') {
      sendMoveableTokenToPush('cea');
      return;
    }

    if (tokenDetails?.source === 'origin') {
      sendMoveableTokenToPush('origin');
      return;
    }

    // if token address is present so it is ERC20 token
    if (!tokenDetails.token?.address) {
      sendPushNativeToken();
    } else {
      sendToken(tokenDetails.token);
    }

  };

  const tokens = useMemo(() => {
      const chainNs = result.chain?.toLowerCase();
      const chainId = Number(result.chainId);

      if (chainNs === 'solana') return TOKEN_LISTS.SOLANA;

      // EVM chains
      if (chainNs === 'eip155' || chainNs === 'ethereum') {
          switch (chainId) {
              case 11155111: return TOKEN_LISTS.ETHEREUM;
              case 84532:    return TOKEN_LISTS.BASE;
              case 421614:   return TOKEN_LISTS.ARBITRUM;
              case 97:       return TOKEN_LISTS.BINANCE;
              default:       return TOKEN_LISTS.ETHEREUM;
          }
      }
  }, [result.chain, result.chainId]);

  useEffect(() => {
    const fetchNativeBalance = async () => {
      const balanceToken = tokenDetails?.token ?? tokens?.[0];
      const balanceWallet = tokenDetails?.sourceWallet ?? result;

      if (!tokenDetails?.native) {
        setLoadingNativeBalance(false);
        return;
      }

      if (balanceToken) {
        try {
          setLoadingNativeBalance(true);
          const res = await getNativeTokenBalance(balanceToken, balanceWallet);
          setNativeBalance(res.balance || '0');
        } catch (error) {
          console.error("Error fetching native balance:", error);
          setNativeBalance('0');
        } finally {
          setLoadingNativeBalance(false);
        }
      } else {
        setNativeBalance('0');
        setLoadingNativeBalance(false);
      }
    };

    fetchNativeBalance();
  }, [
    result,
    tokenDetails?.native,
    tokenDetails?.sourceWallet,
    tokenDetails?.token,
    tokens,
  ]);

  useEffect(() => {
    if (txhash && sendState !== 'confirmation') setSendState("confirmation");
  }, [sendState, txhash])

  useEffect(() => {
    setDestinationNetwork('push');
  }, [
    tokenDetails?.native,
    tokenDetails?.source,
    tokenDetails?.token?.address,
  ]);

  useEffect(() => {
    if (!canSelectDestinationNetwork && destinationNetwork !== 'push') {
      setDestinationNetwork('push');
    }
  }, [canSelectDestinationNetwork, destinationNetwork]);

  const value = {
    walletAddress: executorAddress,
    sendState,
    setSendState,
    receiverAddress,
    setReceiverAddress,
    amount,
    setAmount,
    sendingTransaction,
    handleSendTransaction,
    destinationNetwork,
    setDestinationNetwork,
    destinationNetworkOptions,
    selectedDestinationNetwork,
    canSelectDestinationNetwork,
    txhash,
    setTxhash,
    txError,
    setTokenDetails,
    tokenDetails,
    nativeBalance,
    loadingNativeBalance,
    nativeToken: tokens?.[0] ?? null,
  };

  return (
    <SendTokenContext.Provider value={value}>
      {children}
    </SendTokenContext.Provider>
  );
};

export const useSendTokenContext = () => {
  const context = useContext(SendTokenContext);
  if (context === undefined) {
    throw new Error("useSendTokenContext must be used within a SendProvider");
  }
  return context;
};

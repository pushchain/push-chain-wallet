import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { SendTokenState, TokenFormat } from "../types";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { usePushChain } from "../context/PushChainContext";
import { getAppParamValue, WALLET_TO_APP_ACTION } from "common";
import { useEventEmitterContext } from "./EventEmitterContext";
import { ExecuteParams } from "@pushchain/core/src/lib/orchestrator/orchestrator.types";
import { PushChain } from "@pushchain/core";
import { convertCaipToObject, getNativeTokenBalance, getWalletlist } from "../modules/wallet/Wallet.utils";
import { useGlobalState } from "./GlobalContext";
import { TOKEN_LISTS } from "../helpers/TokenHelper";

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
  txhash: string | null;
  txError: string,
  setTxhash: React.Dispatch<React.SetStateAction<string>>;
  tokenDetails: TokenDetails;
  setTokenDetails: React.Dispatch<React.SetStateAction<TokenDetails>>;
  nativeBalance: string;
  loadingNativeBalance: boolean;
  nativeToken: TokenFormat | null;
}

export interface TokenDetails {
  token: TokenFormat | null;
  chainId?: string;
  native: boolean;
}

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

  const { result } = convertCaipToObject(parsedWallet);

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

      if (receipt.hash) {
        setSendState("confirmation");
        setTxhash(receipt.hash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending transaction", error);
      setTxError(error.message)
      setSendingTransaction(false);
    }
  }

  const sendNativeToken = async () => {
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

      if (receipt.hash) {
        setSendState("confirmation");
        setTxhash(receipt.hash);
      }
      setSendingTransaction(false);

    } catch (error) {
      console.error("Error in sending transaction", error);
      setTxError(error.message)
      setSendingTransaction(false);
    }
  }

  const handleSendTransaction = async () => {
    // if token address is present so it is ERC20 token
    if (!tokenDetails.token.address) {
      sendNativeToken();
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
      if (!!tokenDetails.native && !!tokens[0]) {
        try {
          setLoadingNativeBalance(true);
          const res = await getNativeTokenBalance(tokens[0], result);
          setNativeBalance(res.balance || '0');
        } catch (error) {
          console.error("Error fetching native balance:", error);
          setNativeBalance('0');
        } finally {
          setLoadingNativeBalance(false);
        }
      }
    };

    fetchNativeBalance();
  }, [tokenDetails?.native, tokens]);

  useEffect(() => {
    if (txhash && sendState !== 'confirmation') setSendState("confirmation");
  }, [txhash])

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
    txhash,
    setTxhash,
    txError,
    setTokenDetails,
    tokenDetails,
    nativeBalance,
    loadingNativeBalance,
    nativeToken: tokens[0],
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

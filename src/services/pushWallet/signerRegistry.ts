import { privateKeyToAccount } from 'viem/accounts'
import { bytesToHex } from '@noble/hashes/utils'
import { HDKey } from 'viem/accounts'
import nacl from 'tweetnacl'
import { createWalletClient, defineChain, hexToBytes, http, parseTransaction, TypedData, TypedDataDomain } from 'viem'
import { clusterApiUrl, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums'
import type { SignAuthorizationParams, SignedAuthorization } from '@pushchain/core'
import { normalizeSignedAuthorization } from './eip7702'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

export type ChainSignerHandler = (masterNode: HDKey) => Promise<{
  address: string
  signMessage: (data: Uint8Array) => Promise<Uint8Array>
  signAndSendTransaction?: (tx: Uint8Array) => Promise<Uint8Array>
  signTypedData?: ({ domain, types, primaryType, message }: {
    domain: TypedDataDomain;
    types: TypedData;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Uint8Array> | undefined
  signAuthorization?: (
    params: SignAuthorizationParams
  ) => Promise<SignedAuthorization>
}>

export const VIEM_PUSH_TESTNET_DONUT = defineChain({
  id: 42101,
  name: 'Push Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'PC',
    symbol: '$PC',
  },
  rpcUrls: {
    default: {
      http: ['https://evm.donut.rpc.push.org/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Push Testnet Explorer',
      url: 'https://explorer.testnet.push.org/',
    },
  },
});


export const chainSignerRegistry: Partial<Record<CHAIN, ChainSignerHandler>> = {
  [CHAIN.ETHEREUM_MAINNET]: async (masterNode) => {
    const node = masterNode.derive("m/44'/60'/0'/0/0")
    const account = privateKeyToAccount(`0x${bytesToHex(node.privateKey!)}`)
    const walletClient = createWalletClient({
      account,
      chain: VIEM_PUSH_TESTNET_DONUT,
      transport: http(),
    })
    return {
      address: account.address,
      signMessage: async (data) => {
        const sig = await account.signMessage({ message: { raw: data } })
        return hexToBytes(sig)
      },
      signAndSendTransaction: async (unsignedTx) => {
        const hex = `0x${bytesToHex(unsignedTx)}` as `0x${string}`;
        const tx = parseTransaction(hex);
        const txHash = await walletClient.sendTransaction(tx as never);
        return hexToBytes(txHash);
      },
      signTypedData: async (typedData) => {
        const sig = await account.signTypedData(typedData);
        return hexToBytes(sig);
      },
      signAuthorization: async (params) => {
        const auth = await walletClient.signAuthorization({
          account,
          contractAddress: params.contractAddress,
          ...(params.chainId !== undefined ? { chainId: params.chainId } : {}),
          ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
          ...(params.executor !== undefined ? { executor: params.executor } : {}),
        })

        return normalizeSignedAuthorization(auth, params)
      },
    }
  },

  [CHAIN.SOLANA_MAINNET]: async (masterNode) => {
    const node = masterNode.derive("m/44'/501'/0'/0'")
    const keypair = nacl.sign.keyPair.fromSeed(node.privateKey!.subarray(0, 32))
    return {
      address: bs58.encode(keypair.publicKey),
      signMessage: async (data) => nacl.sign.detached(data, keypair.secretKey),
      signAndSendTransaction: async (serializedTx) => {
        const connection = new Connection(clusterApiUrl('testnet'), 'confirmed');

        const tx = Transaction.from(serializedTx);
        const message = tx.serializeMessage();

        const signature = nacl.sign.detached(message, keypair.secretKey);
        const publicKey = new PublicKey(keypair.publicKey);
        tx.addSignature(publicKey, bs58.decode(bs58.encode(signature)));

        const txid = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        return bs58.decode(txid);
      },
    }
  },
}

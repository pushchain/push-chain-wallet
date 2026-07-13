import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { bytesToHex } from '@noble/hashes/utils'
import { hexToBytes, stringToBytes, TypedData, TypedDataDomain } from 'viem'
import { sha256 } from '@noble/hashes/sha256'
import { ENV } from '../../constants'
import { HDKey } from 'viem/accounts'
import api from '../../services/api' // Axios instance
import { PushWalletAppConnectionData } from '../../common'
import { PushChain } from '@pushchain/core'
import { chainSignerRegistry } from './signerRegistry'
import { UniversalSigner } from '@pushchain/core/src/lib/universal/universal.types'
import { CHAIN } from '@pushchain/core/src/lib/constants/enums'

export class PushWallet {
  /**
   * Accounts to Encrypted Derived Key Mapping
   * push_caip_account -> { encDerivedPrivKey, signature }    // 1st Account of Push Wallet
   * evm_caip_account -> { encDerivedPrivKey, signature }     // External ( OPTIONAL )
   * solana_caip_account -> { encDerivedPrivKey, signature }  // External ( OPTIONAL )
   * ... and so on
   */
  public walletToEncDerivedKey: {
    [key: string]: {
      encDerivedPrivKey: any
      signature: Uint8Array
    }
  } = {}

  private constructor(
    /**
     * Decentralized Identifier of the Push Wallet used to map multiple accounts to the same DID
     * Format: `PUSH_DID:SHA256hash`
     * This should not be visible to the user as it is used for internal mapping
     */
    private did: string,
    /**
     * TODO: Encrypt Mnemonic
     * Encrypted Mnemonic of the Push Wallet
     * Encryption is done via PIN / Password / PassKey
     */
    public mnemonic: string,
    /**
     * Specifies ENV for wallet - Currently works on devnet
     */
    private env: ENV,
    public universalSigner: UniversalSigner
  ) { }

  private static async createUniSigner(
    mnemonic: string,
    chain: CHAIN,
  ): Promise<UniversalSigner> {
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const masterNode = HDKey.fromMasterSeed(seed)

    const handler = chainSignerRegistry[chain]
    if (!handler) throw new Error(`Unsupported chain: ${chain}`)

    const {
      address,
      signMessage,
      signAndSendTransaction,
      signTypedData,
      signAuthorization,
    } = await handler(masterNode)

    const signerSkeleton = PushChain.utils.signer.construct(
      {
        address: address,
        chain: CHAIN.PUSH_TESTNET_DONUT
      },
      {
        signMessage: signMessage,
        signAndSendTransaction: signAndSendTransaction,
        signTypedData: signTypedData,
        signAuthorization: signAuthorization,
      }
    );

    return PushChain.utils.signer.toUniversal(signerSkeleton)
  }

  public static signUp = async (
    env: ENV = ENV.STAGING,
    chain: CHAIN = CHAIN.ETHEREUM_MAINNET,
  ) => {
    // 2. Generate Push Wallet
    const pushWallet = await PushWallet.generatePushWallet()

    // 3. Clear Local Storage
    localStorage.removeItem('appConnections')
    // 4. Create Universal Signer
    const universalSigner = await PushWallet.createUniSigner(
      pushWallet.mnemonic,
      chain,
    )

    // 5. Initialize
    return new PushWallet(
      pushWallet.did,
      pushWallet.mnemonic,
      env,
      universalSigner
    )
  }

  public static logInWithMnemonic = async (
    mnemonic: string,
    env: ENV = ENV.STAGING,
    chain: CHAIN = CHAIN.ETHEREUM_MAINNET,
  ) => {
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const masterNode = HDKey.fromMasterSeed(seed)

    const did = `PUSH_DID:${bytesToHex(sha256(masterNode.publicKey))}`
    const universalSigner = await PushWallet.createUniSigner(
      mnemonic,
      chain,
    )

    return new PushWallet(did, mnemonic, env, universalSigner)
  }

  // /**
  //  * Get Push Wallet details from Push Network
  //  * @param account - account in CAIP-10 Format
  //  */
  // private static getPushWallet = async (
  //   account: string
  // ): Promise<null | EncPushAccount> => {
  //   const encPushAccount = await this.pushValidator.call<null | AccountInfo>(
  //     'push_accountInfo',
  //     [account]
  //   )
  //   return encPushAccount.items.length > 0
  //     ? {
  //         did: encPushAccount.items[0].did,
  //         derivedKeyIndex: parseInt(encPushAccount.items[0].derivedkeyindex),
  //         encDerivedPrivKey: {
  //           ...JSON.parse(encPushAccount.items[0].encryptedderivedprivatekey),
  //           preKey: JSON.parse(
  //             encPushAccount.items[0].encryptedderivedprivatekey
  //           ).prekey,
  //         },
  //         attachedaccounts: encPushAccount?.items[0]?.attachedaccounts?.map(
  //           (account) => account.address
  //         ),
  //       }
  //     : null
  // }

  /**
   * @description Derives a hardened key from master key
   * @param masterNode
   * @param derivedKeyIndex - Useful in case of flushing keys
   * @param accountIndex - Might be useful when push wallet support multiple account
   */
  private static generateDerivedNode = async (
    masterNode: HDKey,
    derivedKeyIndex: number = 0,
    accountIndex: number = 0
  ): Promise<HDKey> => {
    /*
    Purpose (44'): Specifies BIP-44.
    Coin Type (60'): Specifies Ethereum (60 is the coin type for Ethereum).
    Account Index (0'): Used to manage different accounts in the wallet.
    Change Index (0): 0 for external addresses, 1 for internal/change addresses.
    Address Index : Keeps incrementing for generating next accounts
  */
    const rootPath = "m/44'/60'/0'/0"
    const DERIVED_KEY_PATH = `${rootPath}/${accountIndex}/0'/${derivedKeyIndex}'`
    return masterNode.derive(DERIVED_KEY_PATH)
  }

  private static generatePushWallet = async () => {
    // 1. Generate Mnemonic - 128 bit ( 12 words )
    const mnemonic = bip39.generateMnemonic(wordlist)
    // 2. Generate Master Node
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const masterNode = HDKey.fromMasterSeed(seed)
    // 3. Generate PUSH DID
    const did = `PUSH_DID:${bytesToHex(sha256(masterNode.publicKey))}`
    // 4. Generate Derived Node
    const derivedNode = await this.generateDerivedNode(masterNode)
    return {
      mnemonic,
      masterNode,
      did,
      derivedNode,
    }
  }

  // public registerPushAccount = async () => {
  //   if (!PushWallet.unRegisteredProfile)
  //     throw Error('Only Allowed for Unregistered Profile')

  //   // 1. Create Init_did tx
  //   const seed = await bip39.mnemonicToSeed(this.mnemonic)
  //   const masterNode = HDKey.fromMasterSeed(seed)

  //   const derivedNode = await PushWallet.generateDerivedNode(masterNode)

  //   const account = privateKeyToAccount(
  //     `0x${bytesToHex(masterNode.privateKey as Uint8Array)}`
  //   )

  //   const txData = {
  //     masterPubKey: bytesToHex(masterNode.publicKey as Uint8Array),
  //     derivedKeyIndex: derivedNode.index,
  //     derivedPubKey: bytesToHex(derivedNode.publicKey as Uint8Array),
  //     walletToEncDerivedKey: this.walletToEncDerivedKey,
  //   }

  //   const signerSkeleton = PushChain.utils.signer.construct(
  //       {
  //         address: account.address,
  //         chain: CHAIN.PUSH_TESTNET_DONUT
  //       },
  //       {
  //         signMessage: async (dataToBeSigned: Uint8Array) => {
  //           const signature = await account.signMessage({
  //             message: { raw: dataToBeSigned },
  //           })
  //           return hexToBytes(signature)
  //         },
  //         signTransaction: async (tx: Uint8Array) => {
  //           const transaction = parseTransaction(`0x${bytesToHex(tx)}`);
  //           const sig = await account.signTransaction(transaction);
  //           return hexToBytes(sig);
  //         },
  //         signTypedData: async (typedData: {
  //           domain: TypedDataDomain;
  //           types: TypedData;
  //           primaryType: string;
  //           message: Record<string, unknown>;
  //         }) => {
  //           const sig = await account.signTypedData(typedData);
  //           return hexToBytes(sig);
  //         },
  //       }
  //     );

  //   const universalSigner = await PushChain.utils.signer.toUniversal(
  //     signerSkeleton
  //   );

  //   const pushChain = await PushChain.initialize(universalSigner, {
  //     network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT,
  //     rpcUrls: {
  //       'eip155:9000': import.meta.env.VITE_APP_RPC_URL
  //     },
  //   })

  //   PushWallet.unRegisteredProfile = false
  // }

  public storeMnemonicShareAsEncryptedTx = async (
    userId: string,
    mnemonicShare: string,
  ) => {
    try {
      // 1. Get registration options from server
      const response = await api.post('/auth/passkey/register-credential', {
        userId,
      })
      const options = response.data

      // 2. Convert challenge and user ID to ArrayBuffer
      if (typeof options.publicKey.challenge === 'string') {
        options.publicKey.challenge = PushWallet.base64URLToBuffer(
          options.publicKey.challenge
        )
      }

      if (typeof options.publicKey.user.id === 'string') {
        options.publicKey.user.id = PushWallet.base64URLToBuffer(
          options.publicKey.user.id
        )
      }

      // 3. Create credential
      const credential = await navigator.credentials.create(options)

      if (!credential) {
        throw new Error('Failed to create PassKey credential')
      }

      // 4. Send credential to server for verification
      await api.post('/auth/passkey/verify-registration', {
        userId,
        credential: {
          id: (credential as PublicKeyCredential).id,
          rawId: PushWallet.bufferToBase64URL(
            (credential as PublicKeyCredential).rawId
          ),
          response: {
            attestationObject: PushWallet.bufferToBase64URL(
              (
                (credential as PublicKeyCredential)
                  .response as AuthenticatorAttestationResponse
              ).attestationObject
            ),
            clientDataJSON: PushWallet.bufferToBase64URL(
              (
                (credential as PublicKeyCredential)
                  .response as AuthenticatorAttestationResponse
              ).clientDataJSON
            ),
            transports:
              (
                (credential as PublicKeyCredential)
                  .response as AuthenticatorAttestationResponse
              ).getTransports?.() || [],
          },
          type: (credential as PublicKeyCredential).type,
          clientExtensionResults: (
            credential as PublicKeyCredential
          ).getClientExtensionResults(),
        },
      })

      // 4. Encrypt mnemonic share using the credential
      const subtle = window.crypto.subtle
      const encoder = new TextEncoder()
      const data = encoder.encode(mnemonicShare)

      // Generate salt and derive encryption key
      const salt = new Uint8Array(16)
      window.crypto.getRandomValues(salt)

      const keyMaterial = await subtle.importKey(
        'raw',
        (credential as PublicKeyCredential).rawId,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      const encryptionKey = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt.buffer,
          iterations: 100000,
          hash: { name: 'SHA-256' },
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      )

      // Encrypt the data
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encryptedData = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        encryptionKey,
        data
      )

      // Combine salt and encrypted data
      const combinedData = new Uint8Array([
        ...salt,
        ...iv,
        ...new Uint8Array(encryptedData),
      ])

      const hexData = bytesToHex(combinedData);

      // here is the new backend call
      await api.post(`/mnemonic-share`, { share: hexData, type: 'TYPE2' });

    } catch (error) {
      console.error('Error in sendMenomicShare:', error)
      throw error
    }
  }

  public static async retrieveMnemonicShareFromTx(
    env: ENV,
    userId: string,
    share: string
  ): Promise<string> {
    try {
      const txData = share;

      // 3. Decode encrypted data from base64
      const encryptedData = hexToBytes(`0x${txData}`);

      // Get authentication challenge from server
      const challengeResponse = await api.get(
        `/auth/passkey/challenge/${userId}`
      )
      const options: PublicKeyCredentialRequestOptions = {
        challenge: this.base64URLToBuffer(challengeResponse.data.challenge),
        rpId: window.location.hostname,
        timeout: 60000,
        userVerification: 'required',
        allowCredentials: [], // Server should provide the credential IDs
      }

      // Request PassKey authentication
      const credential = (await navigator.credentials.get({
        publicKey: options,
      })) as PublicKeyCredential


      if (!credential) {
        throw new Error('Failed to get PassKey credential')
      }

      // 6. Extract components from encrypted data
      const salt = encryptedData.slice(0, 16)
      const iv = encryptedData.slice(16, 28)
      const actualEncryptedData = encryptedData.slice(28, -16)  // Rest of the data minus auth tag
      const authTag = encryptedData.slice(-16)
      const dataWithTag = new Uint8Array([...actualEncryptedData, ...authTag])

      // 6. Derive decryption key
      const subtle = window.crypto.subtle
      const keyMaterial = await subtle.importKey(
        'raw',
        credential.rawId,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )
      const decryptionKey = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: { name: 'SHA-256' },
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )

      // 7. Decrypt the data
      const decryptedBuffer = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        decryptionKey,
        dataWithTag.buffer
      )

      // 8. Convert decrypted buffer to string
      const decoder = new TextDecoder()
      const mnemonicShare = decoder.decode(decryptedBuffer)

      // Verify authentication with server
      await api.post(`/auth/passkey/verify/${userId}`, {
        id: credential.id,
        rawId: this.bufferToBase64URL(credential.rawId),
        authenticatorData: this.bufferToBase64URL(
          (credential.response as AuthenticatorAssertionResponse)
            .authenticatorData
        ),
        clientDataJSON: this.bufferToBase64URL(
          (credential.response as AuthenticatorAssertionResponse).clientDataJSON
        ),
        signature: this.bufferToBase64URL(
          (credential.response as AuthenticatorAssertionResponse).signature
        ),
      })

      return mnemonicShare
    } catch (error) {
      console.error('Error retrieving mnemonic share from transaction:', error)
      throw error
    }
  }

  private static bufferToBase64URL(buffer: ArrayBuffer): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private static base64URLToBuffer(base64URL: string): ArrayBuffer {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    )
    const binary = atob(paddedBase64)
    const buffer = new ArrayBuffer(binary.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i)
    }
    return buffer
  }

  /**
   * @param data data to be signed
   * @param origin origin from where the sig Req is incoming
   * @returns signature
   */
  public signMessage = async (
    data: string | Uint8Array,
    origin?: string,
    appConnections?: PushWalletAppConnectionData[]
  ): Promise<Uint8Array> => {

    if (origin && appConnections) {
      const appFound = appConnections.find((each) => each.origin === origin)
      if (!appFound) throw Error('App not Connected')
    }

    return await this.universalSigner.signMessage(
      typeof data === 'string' ? stringToBytes(data) : data
    )
  }

  public signAndSendTransaction = async (
    data: string | Uint8Array,
    origin?: string,
    appConnections?: PushWalletAppConnectionData[]
  ): Promise<Uint8Array> => {
    if (origin && appConnections) {
      const appFound = appConnections.find((each) => each.origin === origin)
      if (!appFound) throw Error('App not Connected')
    }
    return await this.universalSigner.signAndSendTransaction(
      typeof data === 'string' ? stringToBytes(data) : data
    )
  }


  public signTypedData = async (
    data: {
      domain: TypedDataDomain;
      types: TypedData;
      primaryType: string;
      message: Record<string, unknown>;
    },
    origin?: string,
    appConnections?: PushWalletAppConnectionData[]
  ): Promise<Uint8Array> => {

    if (origin && appConnections) {
      const appFound = appConnections.find((each) => each.origin === origin)
      if (!appFound) throw Error('App not Connected')
    }

    return await this.universalSigner.signTypedData(data)
  }
}

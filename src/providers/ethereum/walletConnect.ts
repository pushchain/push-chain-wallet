import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { getAddress } from 'ethers';
import { ChainType, ITypedData } from '../../types/wallet.types';
import { BaseWalletProvider } from '../BaseWalletProvider';
import * as chains from 'viem/chains';
import { hexToBytes, parseTransaction, toHex } from 'viem';

export class WalletConnectProvider extends BaseWalletProvider {
    private provider: InstanceType<typeof EthereumProvider> | null = null;

    constructor() {
        super('WalletConnect', 'https://walletconnect.com/walletconnect-logo.svg', [
            ChainType.WALLET_CONNECT,
        ]);
    }

    isInstalled = async (): Promise<boolean> => {
        return true;
    };

    getProvider = () => {
        if (!this.provider) {
            throw new Error('WalletConnect provider not initialized');
        }
        return this.provider;
    };

    private async initProvider(chainId: number) {
        console.log('Provder >>', this.provider);

        if (this.provider) {
            const hasSession = (this.provider as any).session
                && (this.provider as any).session?.topic;

            if (hasSession) {
                return;
            }

            await this.provider.disconnect();

            this.provider = null;
        }

        this.provider = await EthereumProvider.init({
            projectId: 'd73cf3ac4a677153d241b2bd5092fb1d',
            chains: [chainId],
            methods: [
                'eth_sendTransaction',
                'personal_sign',
                'eth_signTypedData_v4',
                'eth_requestAccounts',
                'eth_chainId',
                'eth_accounts',
                'wallet_switchEthereumChain',
                'wallet_addEthereumChain'
            ],
            showQrModal: true,
            rpcMap: {
                '11155111': 'https://sepolia.gateway.tenderly.co/',
            },
            optionalChains: [],
        });

        await this.provider.enable();
    }

    async connect(): Promise<{ caipAddress: string }> {
        try {
            const chain = chains['sepolia'] as chains.Chain;
            const chainId = chain.id;

            await this.initProvider(chainId);

            const accounts = (await this.provider!.request({
                method: 'eth_requestAccounts',
            })) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('No connected account');
            }

            const rawAddress = accounts[0];
            const checksumAddress = getAddress(rawAddress);

            const caipAddress = this.formatAddress(
                checksumAddress,
                ChainType.ETHEREUM,
                chainId
            );
            return caipAddress;
        } catch (error) {
            console.error('Failed to connect to MetaMask:', error);
            throw error;
        }
    }

    getChainId = async (): Promise<number> => {
        const provider = this.getProvider();
        if (!provider) {
            throw new Error('Provider is undefined');
        }
        const hexChainId = (await provider.request({
            method: 'eth_chainId',
            params: [],
        }));

        const chainId = parseInt(hexChainId.toString(), 16);
        return chainId;
    };

    switchNetwork = async (chainType: ChainType) => {
        const provider = this.getProvider();
        const network = chains[chainType] as chains.Chain;
        const hexChainId = toHex(network.id);

        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }],
            });
        } catch (err: any) {
            if (err.code === 4902) {
                try {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: hexChainId,
                                chainName: network.name,
                                rpcUrls: network.rpcUrls.default.http,
                                nativeCurrency: network.nativeCurrency,
                                blockExplorerUrls: [network.blockExplorers.default.url],
                            },
                        ],
                    });
                } catch (addError) {
                    console.error('Error adding network:', addError);
                    throw addError;
                }
            } else {
                console.error('Error switching network:', err);
                throw err;
            }
        }
    };

    signAndSendTransaction = async (txn: Uint8Array): Promise<Uint8Array> => {
        try {
            const provider = this.getProvider();
            if (!provider) {
                throw new Error('Provider is undefined');
            }
            const accounts = (await provider.request({
                method: 'eth_accounts',
            })) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('No connected account');
            }

            const hex = ('0x' + Buffer.from(txn).toString('hex')) as `0x${string}`;
            const parsed = parseTransaction(hex);

            const txParams = {
                from: accounts[0],
                to: parsed.to,
                value: parsed.value ? '0x' + parsed.value.toString(16) : undefined,
                data: parsed.data,
                gas: parsed.gas ? '0x' + parsed.gas.toString(16) : undefined,
                maxPriorityFeePerGas: parsed.maxPriorityFeePerGas
                    ? '0x' + parsed.maxPriorityFeePerGas.toString(16)
                    : undefined,
                maxFeePerGas: parsed.maxFeePerGas
                    ? '0x' + parsed.maxFeePerGas.toString(16)
                    : undefined,
            };

            const signature = await provider.request({
                method: 'eth_sendTransaction',
                params: [txParams],
            });

            return new Uint8Array(Buffer.from((signature as string).slice(2), 'hex'));
        } catch (error) {
            console.error('MetaMask signing error:', error);
            throw error;
        }
    };

    signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
        try {
            const provider = this.getProvider();
            if (!provider) {
                throw new Error('Provider is undefined');
            }
            const accounts = (await provider.request({
                method: 'eth_accounts',
            })) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('No connected account');
            }

            const hexMessage = '0x' + Buffer.from(message).toString('hex');

            const signature = await provider.request({
                method: 'personal_sign',
                params: [hexMessage, accounts[0]],
            });

            return new Uint8Array(Buffer.from((signature as string).slice(2), 'hex'));
        } catch (error) {
            console.error('MetaMask signing error:', error);
            throw error;
        }
    };

    signTypedData = async (typedData: ITypedData): Promise<Uint8Array> => {
        const provider = this.getProvider();
    
        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];
    
        if (!accounts || accounts.length === 0) {
          throw new Error("No connected Rabby account");
        }
    
        typedData.types = {
          EIP712Domain: [
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...(typedData.primaryType === 'MigrationPayload'
            ? { MigrationPayload: typedData.types['MigrationPayload'] }
            : { UniversalPayload: typedData.types['UniversalPayload'] }),
        };
    
        const signature = await provider.request({
          method: "eth_signTypedData_v4",
          params: [accounts[0], JSON.stringify(typedData)],
        });
    
        return hexToBytes(signature as `0x${string}`);
    };

    disconnect = async () => {
        const provider = this.getProvider();
        if (provider && typeof provider.disconnect === 'function') {
            await provider.disconnect();
        }
        this.provider = null;
    };
}

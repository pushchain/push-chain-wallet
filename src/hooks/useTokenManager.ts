import { ERC20ABI } from 'common';
import { useEffect, useState } from 'react';
import { TokenFormat } from '../types';
import { isAddress } from 'viem';
import { viemClient } from '../utils/viemClient';
import { PushChain } from '@pushchain/core';
import { usePushChain } from '../context/PushChainContext';
import { Contract, JsonRpcProvider } from 'ethers';
import { getPrc20Address } from '../utils/prc20TokenDetails';

const DEFAULT_TOKEN = {
    name: 'Push Chain',
    symbol: 'PC',
    address: '',
    decimals: 18,
};

const ERC20_ABI = [
  "function symbol() view returns (string)",
];

export function useTokenManager() {
    const [tokens, setTokens] = useState<TokenFormat[]>([DEFAULT_TOKEN]);
    const [prc20Tokens, setPrc20Tokens] = useState<TokenFormat[]>([]);

    const { pushChainClient } = usePushChain();

    const provider = new JsonRpcProvider("https://evm.donut.rpc.push.org/");

    const getTokenSymbol = async (tokenAddress: string) => {
        try {
            const contract = new Contract(tokenAddress, ERC20_ABI, provider);
            return await contract.symbol();
        } catch (e) {
            console.error("symbol() failed", e);
            return null;
        }
    }

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem("userTokens") || "[]");

        // Merge stored tokens with default only if default not present
        const merged = [DEFAULT_TOKEN, ...stored.filter(t => t.address.toLowerCase() !== DEFAULT_TOKEN.address.toLowerCase())];
        setTokens(merged);
    }, []);

    useEffect(() => {
        localStorage.setItem("userTokens", JSON.stringify(tokens));
    }, [tokens]);

    useEffect(() => {
        if (!pushChainClient) {
            setPrc20Tokens([]);
            return;
        }

        const loadPrc20Tokens = async () => {
            try {
                const moveableTokens = PushChain.utils.tokens.getMoveableTokens(
                    pushChainClient.universal.origin.chain
                ).tokens;

                const prc20 = (
                    await Promise.all(
                        moveableTokens.map(async (token) => {
                            try {
                                const prc20Address = PushChain.utils.tokens.getPRC20Address(token);

                                const prc20Symbol = await getTokenSymbol(prc20Address);

                                return [{
                                    name: prc20Symbol || token.symbol,
                                    symbol: prc20Symbol || token.symbol,
                                    address: prc20Address,
                                    decimals: token.decimals,
                                }];
                            } catch {
                                const prc20Address = getPrc20Address(token.symbol, token.chain);

                                const prc20Symbol = await getTokenSymbol(prc20Address);

                                return [{
                                    name: prc20Symbol || token.symbol,
                                    symbol: prc20Symbol || token.symbol,
                                    address: prc20Address,
                                    decimals: token.decimals,
                                }];
                            }
                        })
                    )
                ).flatMap((x) => x);

                setPrc20Tokens(prc20);
            } catch (err) {
                console.error("Failed to load PRC20 tokens", err);
            }
        }

        loadPrc20Tokens();
        
    }, [pushChainClient]);

    const fetchTokenDetails = async (address: `0x${string}`): Promise<TokenFormat> => {
        try {
            if (!isAddress(address)) return

            const [symbol, decimals, name] = await Promise.all([
                viemClient.readContract({ address, abi: ERC20ABI, functionName: 'symbol' }) as Promise<string>,
                viemClient.readContract({ address, abi: ERC20ABI, functionName: 'decimals' }) as Promise<number>,
                viemClient.readContract({ address, abi: ERC20ABI, functionName: 'name' }) as Promise<string>,
            ]);

            return {
                address,
                name,
                symbol,
                decimals,
            } as TokenFormat;
        } catch (err) {
            console.warn("Not a valid token", err);
            throw new Error('No Token Found')
        }
    };

    const addToken = async (tokenDetails: TokenFormat) => {

        const addressInLowerCase = tokenDetails.address.toLowerCase();

        if (tokens.some(t => t.address.toLowerCase() === addressInLowerCase))
            return { error: 'Token already added' };

        if (tokens.length >= 20) return { error: 'Limit of 20 tokens reached' };

        setTokens(prev => [...prev, tokenDetails]);
        return { success: true };
    };

    const removeToken = (address) => {
        setTokens(prev => prev.filter(t => t.address.toLowerCase() !== address.toLowerCase()));
    };

    return { tokens, prc20Tokens, addToken, removeToken, fetchTokenDetails };
}

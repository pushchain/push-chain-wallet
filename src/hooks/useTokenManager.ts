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
    const [moveableTokens, setMoveableTokens] = useState<TokenFormat[]>([]);

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
            setMoveableTokens([]);
            return;
        }

        const loadMoveableTokens = async () => {
            try {
                const tokens = PushChain.utils.tokens.getMoveableTokens(
                    pushChainClient.universal.origin.chain
                ).tokens;

                setMoveableTokens(tokens.map((token) => ({
                    name: token.symbol,
                    symbol: token.symbol,
                    address: token.address,
                    decimals: token.decimals,
                })));
            } catch (err) {
                console.error("Failed to load moveable tokens", err);
            }
        }

        loadMoveableTokens();
        
    }, [pushChainClient]);

    useEffect(() => {
        if (!pushChainClient) {
            setPrc20Tokens([]);
            return;
        }

        let cancelled = false;
        let inFlight = false;

        const loadPrc20Tokens = async () => {
            try {
                if (inFlight) return;
                inFlight = true;

                const account = pushChainClient.universal.account as string | undefined;

                if (!account || !isAddress(account)) {
                    if (!cancelled) setPrc20Tokens([]);
                    inFlight = false;
                    return;
                }

                const url = `https://donut.push.network/api/v2/addresses/${account}/token-balances`;
                const res = await fetch(url);

                if (!res.ok) {
                    if (!cancelled) setPrc20Tokens([]);
                    inFlight = false;
                    return;
                }

                const data = (await res.json()) as Array<{
                    token?: {
                        address?: string;
                        decimals?: string | number | null;
                        name?: string | null;
                        symbol?: string | null;
                        type?: string | null;
                    } | null;
                }>;

                const mapped = (Array.isArray(data) ? data : [])
                    .filter((item) => item?.token?.type === 'ERC-20')
                    .map((item) => {
                        const address = item?.token?.address ?? '';
                        const decimalsRaw = item?.token?.decimals;
                        const decimals =
                            typeof decimalsRaw === 'number'
                                ? decimalsRaw
                                : typeof decimalsRaw === 'string'
                                    ? Number(decimalsRaw)
                                    : 18;

                        return {
                            name: item?.token?.name ?? '',
                            symbol: item?.token?.symbol ?? '',
                            address,
                            decimals: Number.isFinite(decimals) ? decimals : 18,
                        } as TokenFormat;
                    })
                    .filter((t) => isAddress(t.address as `0x${string}`));

                if (!cancelled) setPrc20Tokens(mapped);
                inFlight = false;
            } catch (err) {
                console.error('Failed to load PRC20 tokens', err);
                if (!cancelled) setPrc20Tokens([]);
                inFlight = false;
            }
        };

        loadPrc20Tokens();
        const intervalId = window.setInterval(loadPrc20Tokens, 15_000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
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

    return { tokens, moveableTokens, prc20Tokens, addToken, removeToken, fetchTokenDetails };
}

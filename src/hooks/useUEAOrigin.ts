import { ethers } from 'ethers';
import { useState, useEffect } from 'react';

const IUEAFactoryABI = [
    'function getOriginForUEA(address addr) view returns (tuple(string chainNamespace, string chainId, bytes owner) account, bool isUEA)',
];

type UEAOrigin = {
    owner: string;
    isUEA: boolean;
    chainNamespace: string;
    chainId: string;
};

type ReturnValue = {
    ueaOrigin: UEAOrigin | null;
    isLoading: boolean;
};

const rpcURL = 'https://evm.donut.rpc.push.org/';
const factoryAddress = '0x00000000000000000000000000000000000000eA';
const COOLDOWN_MS = 30_000;
let last429 = 0;

const provider = new ethers.JsonRpcProvider(rpcURL, undefined, {
  staticNetwork: true,
  polling: false,
});

const ueaOriginCache = new Map<string, UEAOrigin | null>();

const useUEAOrigin = (addressHash: string | null | undefined): ReturnValue => {
    const cacheKey = addressHash?.toLowerCase() ?? '';
    const hasCachedOrigin = cacheKey ? ueaOriginCache.has(cacheKey) : false;

    const [ueaOrigin, setUEAOrigin] = useState<UEAOrigin | null>(
        () => (hasCachedOrigin ? ueaOriginCache.get(cacheKey) ?? null : null),
    );
    const [isLoading, setIsLoading] = useState(
        () => !!cacheKey && !hasCachedOrigin,
    );

    useEffect(() => {
        if (!addressHash || !cacheKey) {
            setUEAOrigin(null);
            setIsLoading(false);
            return;
        }

        if (ueaOriginCache.has(cacheKey)) {
            setUEAOrigin(ueaOriginCache.get(cacheKey) ?? null);
            setIsLoading(false);
            return;
        }

        if (last429 !== 0 && Date.now() - last429 < COOLDOWN_MS) {
            setUEAOrigin(null);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetchOrigin = async () => {
            setIsLoading(true);

            try {
                const factory = new ethers.Contract(
                    factoryAddress,
                    IUEAFactoryABI,
                    provider,
                );

                const result = await factory.getOriginForUEA(addressHash);

                if (cancelled) return;

                const account = result.account;
                const isUEA = result.isUEA;

                // Format owner as 0x string (if needed)
                const ownerHex = ethers.hexlify(account.owner);

                const origin = {
                    owner: ownerHex,
                    isUEA,
                    chainNamespace: account.chainNamespace,
                    chainId: account.chainId,
                };

                ueaOriginCache.set(cacheKey, origin);
                setUEAOrigin(origin);
            } catch (err) {
                if (err?.status === 429) {
                    last429 = Date.now();
                }

                if (!cancelled) {
                    setUEAOrigin(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchOrigin();

        return () => {
            cancelled = true;
        };
    }, [addressHash, cacheKey]);

    return { ueaOrigin, isLoading };
};

export default useUEAOrigin;

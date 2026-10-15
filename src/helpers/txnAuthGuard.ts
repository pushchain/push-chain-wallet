import { PushChain, type AgenticWallet } from "@pushchain/core";
import { UniversalSigner } from "@pushchain/core/src/lib/universal/universal.types";
import type { GlobalAction } from "../context/GlobalContext";
import { ExternalWalletType } from "../types/wallet.types";

export async function checkAndShowUpgradeIfNeeded(
  pushChainClient: PushChain,
  dispatch?: (action: GlobalAction) => void,
): Promise<boolean> {
  await pushChainClient.accountStatusReady;
  if (!pushChainClient.isReadMode && pushChainClient.accountStatus.uea.loaded && pushChainClient.accountStatus.uea.requiresUpgrade) {
    dispatch?.({ 
      type: "SHOW_UPGRADE_DRAWER", 
      payload: { 
        currentVersion: pushChainClient.accountStatus.uea.version, 
        newVersion: pushChainClient.accountStatus.uea.minRequiredVersion, 
      } 
    });
    return true;
  }
  
  return false;
}

export function createGuardedPushChain(
  baseClient: PushChain,
	handleReconnectExternalWallet: (walletData: ExternalWalletType) => Promise<void>,
	handleReconnectWallet: () => void,
	universalSigner: UniversalSigner,
	intializeProps: Parameters<PushChain["reinitialize"]>[1],
	callback?: () => void,
	dispatch?: (action: GlobalAction) => void,
): PushChain {
  const clientRef: { current: PushChain } = { current: baseClient };

  let promoting: Promise<void> | null = null;

  const promoteIfNeeded = async () => {
    if (!clientRef.current.isReadMode) return;

    if (!promoting) {
      promoting = (async () => {
        const walletInfo = localStorage.getItem("walletInfo");
        const walletData = walletInfo ? JSON.parse(walletInfo) : null;

				if (!walletData) {
					return;
				}

				if (walletData.providerName) {
					await handleReconnectExternalWallet(walletData);
				} else {
					await handleReconnectWallet();
				}

				const pushChainClient = await clientRef.current.reinitialize(universalSigner, intializeProps);

				callback?.();

				clientRef.current = pushChainClient;
				
      })().finally(() => {
        promoting = null;
      });
    }
    await promoting;
  };

  const checkUpgradeNeeded = async () => {
		const upgradeNeeded = await checkAndShowUpgradeIfNeeded(clientRef.current, dispatch);
		if (upgradeNeeded) {
			throw new Error('Account upgrade required before performing write operations');
		}
	};

	const wrapWrite = <A extends unknown[], R>(
    getter: () => (...args: A) => Promise<R>
	) => {
	const wrapped = async (...args: A): Promise<R> => {
		await promoteIfNeeded();
		await checkUpgradeNeeded();
		const fn = getter();
		return fn(...args);
	};
		return wrapped;
	};

  const universalProxy = new Proxy({} as PushChain["universal"], {
    get(target, p) {
      void target;
      const u = clientRef.current.universal;
      if (p === "sendTransaction") {
        return wrapWrite(() => clientRef.current.universal.sendTransaction);
      }
      if (p === "prepareTransaction") {
        return wrapWrite(() => clientRef.current.universal.prepareTransaction);
      }
      if (p === "executeTransactions") {
        return wrapWrite(() => clientRef.current.universal.executeTransactions);
      }
      if (p === "signMessage") {
        return wrapWrite(() => clientRef.current.universal.signMessage);
      }
      if (p === "signTypedData") {
        return wrapWrite(() => clientRef.current.universal.signTypedData);
      }
      return u[p];
    },
  });

  // Agentic wallet writes go through the same promotion and upgrade checks as universal writes.
  // A handle is rebuilt from the current client on each call, so promotion is never stale.
  const agenticWalletHandle = (address: `0x${string}`): AgenticWallet => {
    const current = () => clientRef.current.agentic.wallet(address);
    return {
      address,
      info: () => current().info(),
      owner: () => current().owner(),
      checkpoints: (opts) => current().checkpoints(opts),
      setLabel: wrapWrite(() => (...args: Parameters<AgenticWallet["setLabel"]>) => current().setLabel(...args)),
      rules: {
        list: () => current().rules.list(),
        get: (rulesId) => current().rules.get(rulesId),
        add: wrapWrite(() => current().rules.add),
        update: wrapWrite(() => current().rules.update),
        // delete is overloaded (ids or { all: true }); the wrapper forwards either form unchanged.
        delete: wrapWrite(() => current().rules.delete) as AgenticWallet["rules"]["delete"],
      },
    };
  };

  const agenticProxy = new Proxy({} as PushChain["agentic"], {
    get(target, p) {
      void target;
      const agentic = clientRef.current.agentic;
      if (p === "create") {
        return wrapWrite(() => agentic.create.bind(clientRef.current.agentic));
      }
      if (p === "wallet") return agenticWalletHandle;
      const value = agentic[p as keyof typeof agentic];
      return typeof value === "function" ? value.bind(agentic) : value;
    },
  });

  const clientProxy = new Proxy(baseClient, {
    get(target, prop) {
      void target;
      if (prop === "universal") return universalProxy;
      if (prop === "agentic") return agenticProxy;
      return clientRef.current[prop];
    },
  });

  return clientProxy;
}

import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AgenticAddress, AgenticHex } from '@pushchain/core';
import { usePushChain } from '../../../../context/PushChainContext';
import { describeAgenticError, fromRulesRecord, toSdkRule } from './agenticWallet.sdk';
import { registry, useAgenticRegistry } from './agenticWallet.storage';
import { AgenticRule, AgenticWallet } from './agenticWallet.types';

/*
 * Agentic wallets of the connected owner, read from and written to the AGW contracts
 * through the SDK's `client.agentic`. Rule edits are applied as a diff against what is
 * on chain: revoke removed rules, update changed ones (new id, fresh counters), add new ones.
 */
type AgenticWalletContextType = {
  wallets: AgenticWallet[];
  loading: boolean;
  /* Error from the last load, for the list screen */
  error: string | null;
  /* False when the SDK client is not ready (still initialising, or signed out) */
  available: boolean;
  refresh: () => Promise<void>;
  /* Loads the wallets the first time the Agentic Wallets screens open, or when the cache is stale */
  ensureLoaded: () => void;
  /* Reads a wallet's rules when it's opened (no-op once loaded) */
  loadRules: (address: AgenticAddress) => void;
  createWallet: (name: string, rules: AgenticRule[]) => Promise<AgenticAddress>;
  applyRuleChanges: (wallet: AgenticWallet, next: AgenticRule[]) => Promise<void>;
  revokeRule: (wallet: AgenticWallet, rulesId: AgenticHex) => Promise<void>;
  /* On-chain label (setLabel), owner only */
  renameWallet: (wallet: AgenticWallet, name: string) => Promise<void>;
  togglePin: (address: string) => void;
};

const AgenticWalletContext = createContext<AgenticWalletContextType | undefined>(undefined);

/* How long a loaded wallet list is reused before reading it from the chain again */
const STALE_MS = 5 * 60_000;

/* Fields that define a rule; anything else (ids, expiry stamp) does not make it "changed". */
const ruleFingerprint = (rule: AgenticRule) =>
  JSON.stringify(
    [rule.networkId, rule.apps, rule.tokens, rule.maxGasPerCall, rule.agentAddress, rule.durationDays],
    // Pins carry bigint limits.
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );

export const AgenticWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { pushChainClient } = usePushChain();
  const { pins } = useAgenticRegistry();
  const [loaded, setLoaded] = useState<Omit<AgenticWallet, 'pinned' | 'pinOrder'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentic = pushChainClient?.agentic;

  const loadWallet = useCallback(
    async (address: AgenticAddress, name: string, index: number) => {
      // One retry: Push's RPC occasionally rate-limits (HTTP 429) a burst of reads.
      const { rules } = await agentic!
        .wallet(address)
        .rules.list()
        .catch(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return agentic!.wallet(address).rules.list();
        });
      const mapped = rules.map(fromRulesRecord);
      return {
        address,
        name,
        index,
        rules: mapped.filter((rule): rule is AgenticRule => !!rule),
        unsupportedRules: mapped.filter((rule) => !rule).length,
        rulesLoaded: true,
      };
    },
    [agentic],
  );

  const refresh = useCallback(async () => {
    if (!agentic) return;
    setLoading(true);
    setError(null);
    try {
      const { wallets } = await agentic.list();
      // list() also reports the owner's next, not-yet-deployed slot. Names and addresses are
      // all the list needs; each wallet's rules are read when it's opened (loadRules).
      setLoaded(
        wallets
          .filter((wallet) => wallet.deployed)
          .map((w) => ({ address: w.address, name: w.label, index: w.index, rules: [], unsupportedRules: 0, rulesLoaded: false })),
      );
    } catch (err) {
      console.error('[agentic] wallets failed to load', err);
      setError(describeAgenticError(err));
    } finally {
      setLoading(false);
    }
  }, [agentic]);

  /*
   * Reading every wallet's rules is dozens of RPC calls each, so it happens only when the
   * Agentic Wallets screens open (not on the home dashboard), and the result is kept:
   * create, edit, delete and rename update it in place. It's read again only after
   * STALE_MS, on "Try again", or for another account.
   */
  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setLoaded([]);
    setError(null);
    setHasLoaded(false);
    loadedAt.current = 0;
  }, [agentic]);

  const load = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = refresh().finally(() => {
        inFlight.current = null;
        loadedAt.current = Date.now();
        setHasLoaded(true);
      });
    }
    return inFlight.current;
  }, [refresh]);

  const ensureLoaded = useCallback(() => {
    if (!agentic) return;
    if (loadedAt.current && Date.now() - loadedAt.current < STALE_MS) return;
    void load();
  }, [agentic, load]);

  const reloadOne = useCallback(
    async (wallet: AgenticWallet) => {
      const info = await agentic!.wallet(wallet.address).info();
      const next = await loadWallet(wallet.address, info.label, info.index);
      setLoaded((prev) => prev.map((w) => (w.address === wallet.address ? next : w)));
    },
    [agentic, loadWallet],
  );

  /* Reads one wallet's rules the first time it's opened; later opens reuse them. */
  const rulesInFlight = useRef(new Map<string, Promise<void>>());
  const loadRules = useCallback(
    (address: AgenticAddress) => {
      const wallet = loaded.find((w) => w.address === address);
      if (!agentic || !wallet || wallet.rulesLoaded || rulesInFlight.current.has(address)) return;
      const request = loadWallet(address, wallet.name, wallet.index)
        .then((next) => setLoaded((prev) => prev.map((w) => (w.address === address ? next : w))))
        .catch((err) => {
          console.error('[agentic] rules failed to load', err);
          setError(describeAgenticError(err));
        })
        .finally(() => rulesInFlight.current.delete(address));
      rulesInFlight.current.set(address, request);
    },
    [agentic, loaded, loadWallet],
  );

  const createWallet = useCallback(
    async (name: string, rules: AgenticRule[]) => {
      if (!agentic) throw new Error('Push Chain client is not ready yet.');
      const sdkRules = rules.map(toSdkRule);
      const created = await agentic.create(name, { rules: sdkRules });
      const next = await loadWallet(created.wallet, name, created.index);
      setLoaded((prev) => [...prev.filter((w) => w.address !== created.wallet), next]);
      return created.wallet;
    },
    [agentic, loadWallet],
  );

  const applyRuleChanges = useCallback(
    async (wallet: AgenticWallet, next: AgenticRule[]) => {
      if (!agentic) throw new Error('Push Chain client is not ready yet.');
      const handle = agentic.wallet(wallet.address);

      const keptIds = new Set(next.map((rule) => rule.rulesId).filter(Boolean));
      const revoked = wallet.rules.filter((rule) => rule.rulesId && !keptIds.has(rule.rulesId));
      const updated = next.filter((rule) => {
        if (!rule.rulesId) return false;
        const original = wallet.rules.find((r) => r.rulesId === rule.rulesId);
        return !!original && ruleFingerprint(original) !== ruleFingerprint(rule);
      });
      const added = next.filter((rule) => !rule.rulesId);

      // Validate everything before the first signature, so a bad row never leaves a half-applied edit.
      const updates = updated.map((rule) => ({ rulesId: rule.rulesId!, rule: toSdkRule(rule) }));
      const additions = added.map(toSdkRule);

      // Revoke first so a replacement for the same agent and network never overlaps the old rule.
      if (revoked.length) await handle.rules.delete(revoked.map((rule) => rule.rulesId!));
      if (updates.length) await handle.rules.update({ rules: updates });
      if (additions.length) await handle.rules.add(additions);

      await reloadOne(wallet);
    },
    [agentic, reloadOne],
  );

  const revokeRule = useCallback(
    async (wallet: AgenticWallet, rulesId: AgenticHex) => {
      if (!agentic) throw new Error('Push Chain client is not ready yet.');
      await agentic.wallet(wallet.address).rules.delete([rulesId]);
      await reloadOne(wallet);
    },
    [agentic, reloadOne],
  );

  const renameWallet = useCallback(
    async (wallet: AgenticWallet, name: string) => {
      if (!agentic) throw new Error('Push Chain client is not ready yet.');
      await agentic.wallet(wallet.address).setLabel(name.trim());
      await reloadOne(wallet);
    },
    [agentic, reloadOne],
  );

  const wallets = useMemo(
    () =>
      loaded.map((wallet) => {
        const pinOrder = pins.indexOf(wallet.address.toLowerCase());
        return { ...wallet, pinned: pinOrder >= 0, pinOrder };
      }),
    [loaded, pins],
  );

  const value = useMemo(
    () => ({
      wallets,
      // Not loaded yet counts as loading, so the list doesn't flash its empty state first.
      loading: loading || (!!agentic && !hasLoaded && !error),
      error,
      available: !!agentic,
      refresh: load,
      ensureLoaded,
      loadRules,
      createWallet,
      applyRuleChanges,
      revokeRule,
      renameWallet,
      togglePin: registry.togglePin,
    }),
    [wallets, loading, hasLoaded, error, agentic, load, ensureLoaded, loadRules, createWallet, applyRuleChanges, revokeRule, renameWallet],
  );

  return <AgenticWalletContext.Provider value={value}>{children}</AgenticWalletContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAgenticWallets = () => {
  const context = useContext(AgenticWalletContext);
  if (!context) throw new Error('useAgenticWallets must be used within AgenticWalletProvider');
  return context;
};

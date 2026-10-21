import { useSyncExternalStore } from 'react';
import { CustomApp, CustomToken } from './agenticWallet.types';

/*
 * Custom contracts, functions and tokens the owner added, kept in localStorage so they
 * show up again in later rules. Keys are per network; addresses are stored lowercased.
 * Pins live here too — the contracts have no notion of a pinned wallet.
 */
type Registry = {
  apps: Record<string, CustomApp[]>;
  /* `${networkId}:${appKey}` → canonical signatures; appKey is a catalog id or a lowercased address */
  functions: Record<string, string[]>;
  tokens: Record<string, CustomToken[]>;
  pins: string[];
  /* `${networkId}:${contract}:${selector}` → readable label from a preset, e.g. "Supply" */
  labels: Record<string, string>;
};

const STORAGE_KEY = 'pw:agentic:registry:v1';
const EMPTY: Registry = { apps: {}, functions: {}, tokens: {}, pins: [], labels: {} };

const read = (): Registry => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Registry>) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

let snapshot: Registry = read();
const listeners = new Set<() => void>();

const write = (next: Registry) => {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the registry still works for this session.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAgenticRegistry = () => useSyncExternalStore(subscribe, () => snapshot);

export const functionKey = (networkId: string, appKey: string) => `${networkId}:${appKey.toLowerCase()}`;

export const registry = {
  get: () => snapshot,

  saveApp(networkId: string, app: CustomApp) {
    const address = app.address.toLowerCase();
    const apps = (snapshot.apps[networkId] ?? []).filter((a) => a.address !== address);
    write({ ...snapshot, apps: { ...snapshot.apps, [networkId]: [...apps, { ...app, address }] } });
  },

  getApp(networkId: string, address: string) {
    return snapshot.apps[networkId]?.find((a) => a.address === address.toLowerCase());
  },

  saveFunctions(networkId: string, appKey: string, signatures: string[]) {
    const key = functionKey(networkId, appKey);
    const merged = Array.from(new Set([...(snapshot.functions[key] ?? []), ...signatures]));
    write({ ...snapshot, functions: { ...snapshot.functions, [key]: merged } });
  },

  replaceFunction(networkId: string, appKey: string, previous: string, next: string) {
    const key = functionKey(networkId, appKey);
    const list = (snapshot.functions[key] ?? []).map((sig) => (sig === previous ? next : sig));
    write({ ...snapshot, functions: { ...snapshot.functions, [key]: Array.from(new Set(list)) } });
  },

  removeFunction(networkId: string, appKey: string, signature: string) {
    const key = functionKey(networkId, appKey);
    const list = (snapshot.functions[key] ?? []).filter((sig) => sig !== signature);
    write({ ...snapshot, functions: { ...snapshot.functions, [key]: list } });
  },

  getFunctions(networkId: string, appKey: string) {
    return snapshot.functions[functionKey(networkId, appKey)] ?? [];
  },

  saveToken(networkId: string, token: CustomToken) {
    const address = token.address.toLowerCase();
    const tokens = (snapshot.tokens[networkId] ?? []).filter((t) => t.address.toLowerCase() !== address);
    write({ ...snapshot, tokens: { ...snapshot.tokens, [networkId]: [...tokens, token] } });
  },

  saveFunctionLabel(networkId: string, contract: string, selector: string, label: string) {
    const key = `${networkId}:${contract.toLowerCase()}:${selector.toLowerCase()}`;
    if (snapshot.labels[key] === label) return;
    write({ ...snapshot, labels: { ...snapshot.labels, [key]: label } });
  },

  getFunctionLabel(networkId: string, contract: string, selector: string) {
    return snapshot.labels[`${networkId}:${contract.toLowerCase()}:${selector.toLowerCase()}`];
  },

  /* Pins are kept in pin order, so the latest pin is last; unpinning drops it from the history. */
  togglePin(walletAddress: string) {
    const address = walletAddress.toLowerCase();
    const pins = snapshot.pins.includes(address)
      ? snapshot.pins.filter((p) => p !== address)
      : [...snapshot.pins, address];
    write({ ...snapshot, pins });
  },
};

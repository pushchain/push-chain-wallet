import { useSyncExternalStore } from "react";
import type { ProgressEvent } from "@pushchain/core/src/lib/progress-hook/progress-hook.types";

/*
 * Latest SDK progress event, published by the Push Chain client's progressHook and read
 * by ProgressToast. originChain (CAIP-2) builds the Donut "Track Live Progress" link.
 */
export type ProgressState = { event: ProgressEvent; originChain?: string } | null;

let current: ProgressState = null;
const listeners = new Set<() => void>();

export const progressStore = {
  get: () => current,
  set(next: ProgressState) {
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

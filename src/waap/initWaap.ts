import { initWaaP } from '@human.tech/waap-sdk';
import { waapInitConfig } from './waap.config';
import { WalletConfig } from '../types/wallet.types';

let waapInitialized = false;

export const ensureWaapInit = (isDarkMode: boolean, config: WalletConfig) => {
  if (typeof window === 'undefined') return;
  if (waapInitialized) return;
  

  initWaaP(waapInitConfig(isDarkMode, config));
  waapInitialized = true;
};
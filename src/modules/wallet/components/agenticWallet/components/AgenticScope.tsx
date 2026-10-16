import { FC, ReactNode, useEffect, useState } from 'react';
import type { PushChain } from '@pushchain/core';
import { PushChainScope, usePushChain } from '../../../../../context/PushChainContext';
import { WalletDashboardProvider, useWalletDashboard } from '../../../../../context/WalletDashboardContext';
import type { TokenDetails } from '../../../../../context/SendTokenContext';
import { ActiveStates, WalletDashboardTab } from '../../../../../types';
import { AText } from '../AgenticWallet.styles';

type AgenticScopeProps = {
  wallet: `0x${string}`;
  /* The wallet screen being shown inside the scope (details, send, swap…) */
  activeState: ActiveStates;
  /* Where the normal wallet screens ask to go: Back/Done ('walletDashboard'), 'send', 'swapDetails'… */
  onNavigate: (state: ActiveStates, tokenDetails?: TokenDetails) => void;
  children: ReactNode;
};

/*
 * Runs the normal wallet screens (token list, sub-accounts, send, swap) as an agentic
 * wallet: the owner-door client from `PushChain.initialize(signer, { agenticWallet })`
 * (created once per wallet and cached), plus a dashboard context whose navigation stays
 * inside the agentic wallet instead of returning to the home dashboard.
 */
const AgenticScope: FC<AgenticScopeProps> = ({ wallet, activeState, onNavigate, children }) => {
  const dashboard = useWalletDashboard();
  const { createAgenticClient, peekAgenticClient } = usePushChain();
  const [client, setClient] = useState<PushChain | null>(() => peekAgenticClient(wallet) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<WalletDashboardTab>('tokens');

  useEffect(() => {
    if (client) return;
    let cancelled = false;
    setError(null);
    createAgenticClient(wallet)
      .then((next) => !cancelled && setClient(next))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
    // createAgenticClient is recreated on every provider render; the wallet is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, client]);

  if (error) {
    return (
      <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
        {`Couldn't load this wallet: ${error}`}
      </AText>
    );
  }
  // Normally ready already (created when the wallet page opens); the screens show their own loading.
  if (!client) return null;

  return (
    <PushChainScope client={client} agenticWallet={wallet}>
      <WalletDashboardProvider
        {...dashboard}
        activeState={activeState}
        setActiveState={(state) => onNavigate(state)}
        startSendFlow={(tokenDetails) => onNavigate('send', tokenDetails)}
        activeDashboardTab={dashboardTab}
        setActiveDashboardTab={setDashboardTab}
      >
        {children}
      </WalletDashboardProvider>
    </PushChainScope>
  );
};

export { AgenticScope };

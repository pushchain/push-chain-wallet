import { FC, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { Spinner } from 'blocks';
import AddTokens from '../AddTokens';
import { usePushChain } from '../../../../context/PushChainContext';
import { useWalletDashboard } from '../../../../context/WalletDashboardContext';
import { Receive } from '../Receive';
import { Send } from '../sendComponent/Send';
import { Swap } from '../swapComponent/Swap';
import { SwapDetails } from '../swapComponent/SwapDetails';
import type { TokenDetails } from '../../../../context/SendTokenContext';
import { ActiveStates } from '../../../../types';
import { AgenticScope } from './components/AgenticScope';
import { describeAgenticError } from './agenticWallet.sdk';
import { AgenticWalletDetails } from './AgenticWalletDetails';
import { AgenticWalletsList } from './AgenticWalletsList';
import { CreateAgenticWallet } from './CreateAgenticWallet';
import { EditAgenticRules, EditRulesEntry } from './EditAgenticRules';
import { useAgenticWallets } from './AgenticWalletContext';

type View =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'details'; address: string }
  | { name: 'receive'; address: string; returnTo: 'list' | 'details' }
  | { name: 'edit'; address: string; entry: EditRulesEntry; returnTo: 'list' | 'details' }
  /* The normal Send / Swap screens, run as the agentic wallet */
  | { name: 'send'; address: string; token: TokenDetails | null }
  | { name: 'swap'; address: string }
  | { name: 'swapDetails'; address: string }
  | { name: 'addTokens'; address: string };

/* Entry point for the "Agentic Wallets" action on the wallet dashboard. */
const AgenticWallets: FC = () => {
  const { setActiveState } = useWalletDashboard();
  const { executorAddress } = usePushChain();
  const { wallets, revokeRule, ensureLoaded, loadRules } = useAgenticWallets();
  const [view, setView] = useState<View>({ name: 'list' });
  // The wallets are read when these screens open (cached afterwards), not with the home dashboard.
  useEffect(ensureLoaded, [ensureLoaded]);
  // A wallet's rules are read when it's opened, from the list or its editor.
  const openAddress = 'address' in view ? view.address : undefined;
  useEffect(() => {
    if (openAddress) loadRules(openAddress as `0x${string}`);
  }, [openAddress, loadRules]);
  const queryClient = useQueryClient();

  const closeToDashboard = () => setActiveState('walletDashboard');
  const showList = () => setView({ name: 'list' });

  if (view.name === 'create') {
    return (
      <CreateAgenticWallet
        pushWalletAddress={executorAddress}
        onExit={showList}
        onClose={closeToDashboard}
        onCreated={(address) => setView({ name: 'details', address })}
      />
    );
  }

  const wallet = 'address' in view ? wallets.find((w) => w.address === view.address) : undefined;
  const back = (returnTo: 'list' | 'details', address: string) =>
    returnTo === 'details' ? setView({ name: 'details', address }) : showList();

  /* Where the normal wallet screens navigate to, kept inside this agentic wallet */
  const scopeNavigate = (address: string) => (state: ActiveStates, tokenDetails?: TokenDetails) => {
    if (state === 'send') setView({ name: 'send', address, token: tokenDetails ?? null });
    else if (state === 'swap') setView({ name: 'swap', address });
    else if (state === 'swapDetails') setView({ name: 'swapDetails', address });
    else if (state === 'receive') setView({ name: 'receive', address, returnTo: 'details' });
    else if (state === 'addTokens') setView({ name: 'addTokens', address });
    else {
      // Back from a send, swap or token change: show this wallet's fresh balances instead of the
      // up-to-15s-old poll. Only its own queries; refetching every query at once bursts the RPC.
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some((part) => typeof part === 'string' && part.toLowerCase() === address.toLowerCase()),
      });
      setView({ name: 'details', address });
    }
  };

  if ((view.name === 'send' || view.name === 'swap' || view.name === 'swapDetails' || view.name === 'addTokens') && wallet) {
    return (
      <AgenticScope wallet={wallet.address} activeState={view.name} onNavigate={scopeNavigate(wallet.address)}>
        {view.name === 'send' && <Send initialTokenDetails={view.token} />}
        {view.name === 'swap' && <Swap />}
        {view.name === 'swapDetails' && <SwapDetails />}
        {view.name === 'addTokens' && <AddTokens />}
      </AgenticScope>
    );
  }

  if (view.name === 'receive') {
    return <Receive address={view.address} onBack={() => back(view.returnTo, view.address)} />;
  }

  if (view.name === 'details' && wallet) {
    return (
      <AgenticWalletDetails
        wallet={wallet}
        onBack={showList}
        onClose={closeToDashboard}
        onReceive={() => setView({ name: 'receive', address: wallet.address, returnTo: 'details' })}
        onSend={() => setView({ name: 'send', address: wallet.address, token: null })}
        onSwap={() => setView({ name: 'swap', address: wallet.address })}
        onScopeNavigate={scopeNavigate(wallet.address)}
        onAddRule={() => setView({ name: 'edit', address: wallet.address, entry: { mode: 'add' }, returnTo: 'details' })}
        onEditRule={(index) =>
          setView({ name: 'edit', address: wallet.address, entry: { mode: 'edit', index }, returnTo: 'details' })
        }
        onDeleteRule={async (index) => {
          const rulesId = wallet.rules[index]?.rulesId;
          if (!rulesId) return;
          try {
            await revokeRule(wallet, rulesId);
          } catch (error) {
            throw new Error(describeAgenticError(error));
          }
        }}
      />
    );
  }

  // The editor starts from the wallet's rules, so it waits for them.
  if (view.name === 'edit' && wallet && !wallet.rulesLoaded) {
    return <RulesLoading />;
  }

  if (view.name === 'edit' && wallet) {
    return (
      <EditAgenticRules
        key={`${wallet.address}-${JSON.stringify(view.entry)}`}
        wallet={wallet}
        entry={view.entry}
        onExit={() => back(view.returnTo, wallet.address)}
        onClose={closeToDashboard}
        onSaved={() => setView({ name: 'details', address: wallet.address })}
      />
    );
  }

  return (
    <AgenticWalletsList
      pushWalletAddress={executorAddress}
      onBack={closeToDashboard}
      onClose={closeToDashboard}
      onCreate={() => setView({ name: 'create' })}
      onOpenWallet={(address) => setView({ name: 'details', address })}
      onFundWallet={(address) => setView({ name: 'receive', address, returnTo: 'list' })}
      onEditRules={(address) => setView({ name: 'edit', address, entry: { mode: 'list' }, returnTo: 'list' })}
    />
  );
};

export { AgenticWallets };

const RulesLoading: FC = () => (
  <LoadingScreen>
    <Spinner size="medium" variant="primary" />
  </LoadingScreen>
);

const LoadingScreen = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 300px;
`;

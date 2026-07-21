import { FC, useState } from "react";
import { Box, Tabs } from "../../../../blocks";
import { WalletActivityList } from "./WalletActivityList";

import { TokensList } from "../TokensList";
import { SubAccountsList } from "../SubAccountsList";
import { ActiveStates, WalletListType } from "../../../../types";
import { trackWalletEvent, WALLET_EVENTS } from "../../../../analytics/walletEvents";

type WalletTabKey = 'tokens' | 'activity' | 'subAccounts' | 'rewards' | 'wallets';

const WALLET_TAB_KEYS: WalletTabKey[] = ['tokens', 'activity', 'subAccounts', 'rewards', 'wallets'];

export type WalletTabsProps = {
  walletList: WalletListType[];
  walletAddress: string | null;
  walletAliases?: string[];
  selectedWallet: WalletListType;
  setSelectedWallet: (wallet: WalletListType) => void;
  setActiveState: (activeStates: ActiveStates) => void;
};

const WalletTabs: FC<WalletTabsProps> = ({
  walletAddress,
  walletAliases = [],
  setActiveState
}) => {
  const [activeTab, setActiveTab] = useState<WalletTabKey>('tokens');

  const handleTabChange = (activeKey: string) => {
    if (!WALLET_TAB_KEYS.includes(activeKey as WalletTabKey) || activeKey === activeTab) return;

    if (activeKey === 'activity') {
      trackWalletEvent(WALLET_EVENTS.ACTIVITY_TAB_CLICKED, {
        walletAddress: walletAddress ?? undefined,
        sourceScreen: 'wallet_dashboard',
        step: 'activity_tab',
      });
    } else if (activeKey === 'subAccounts') {
      trackWalletEvent(WALLET_EVENTS.SUB_ACCOUNTS_TAB_CLICKED, {
        walletAddress: walletAddress ?? undefined,
        sourceScreen: 'wallet_dashboard',
        step: 'sub_accounts_tab',
      });
    }

    setActiveTab(activeKey as WalletTabKey);
  };

  return (
    <Box height="340px">
      <Tabs
        items={[
          {
            label: "Tokens",
            key: "tokens",
            children: (
              activeTab === 'tokens' ? (
                <TokensList setActiveState={setActiveState} />
              ) : null
            )
          },
          {
            label: "Activity",
            key: "activity",
            children: (
              activeTab === 'activity' ? (
                <WalletActivityList
                  address={walletAddress}
                  walletAliases={walletAliases}
                />
              ) : null
            ),
          },
          {
            label: "Sub-Accounts",
            key: "subAccounts",
            children: (
              activeTab === 'subAccounts' ? <SubAccountsList /> : null
            ),
          },
        ]}
        activeKey={activeTab}
        onChange={handleTabChange}
      />
    </Box>
  );
};

export { WalletTabs };

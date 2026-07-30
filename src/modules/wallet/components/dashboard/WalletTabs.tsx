import { FC } from "react";
import { Box, Tabs } from "../../../../blocks";
import { WalletActivityList } from "./WalletActivityList";

import { TokensList } from "../TokensList";
import { SubAccountsList } from "../SubAccountsList";
import {
  ActiveStates,
  WalletDashboardTab,
  WalletListType,
} from "../../../../types";
import { trackWalletEvent, WALLET_EVENTS } from "../../../../analytics/walletEvents";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";

const WALLET_TAB_KEYS: WalletDashboardTab[] = ['tokens', 'activity', 'subAccounts'];

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
  const { activeDashboardTab, setActiveDashboardTab } = useWalletDashboard();

  const handleTabChange = (activeKey: string) => {
    if (
      !WALLET_TAB_KEYS.includes(activeKey as WalletDashboardTab) ||
      activeKey === activeDashboardTab
    ) {
      return;
    }

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

    setActiveDashboardTab(activeKey as WalletDashboardTab);
  };

  return (
    <Box height="340px">
      <Tabs
        items={[
          {
            label: "Tokens",
            key: "tokens",
            children: (
              activeDashboardTab === 'tokens' ? (
                <TokensList setActiveState={setActiveState} />
              ) : null
            )
          },
          {
            label: "Activity",
            key: "activity",
            children: (
              activeDashboardTab === 'activity' ? (
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
              activeDashboardTab === 'subAccounts' ? <SubAccountsList /> : null
            ),
          },
        ]}
        activeKey={activeDashboardTab}
        onChange={handleTabChange}
      />
    </Box>
  );
};

export { WalletTabs };

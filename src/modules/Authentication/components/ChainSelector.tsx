import React, { FC } from "react";
import { WalletCategoriesType } from "../../../types/wallet.types";
import { walletRegistry } from "../../../providers/WalletProviderRegistry";
import WalletSelector from "./WalletSelector";
import { Box, deviceSizes, Text } from "blocks";
import { useDeviceWidthCheck } from "common";

const MOBILE_WALLET_OPTIONS = ["MetaMask", "Phantom"];

interface ChainWalletSelectorProps {
  selectedWalletCategory: WalletCategoriesType;
}

const ChainSelector: FC<ChainWalletSelectorProps> = ({ selectedWalletCategory }) => {
  const isMobile = useDeviceWidthCheck(parseInt(deviceSizes.laptop));
  const wallets = walletRegistry.getProvidersByChain(selectedWalletCategory.chain);
  const hasMobileWalletOptions = wallets.some((wallet) =>
    MOBILE_WALLET_OPTIONS.includes(wallet.name)
  );
  const filteredWallets = isMobile && hasMobileWalletOptions
    ? wallets.filter((wallet) => MOBILE_WALLET_OPTIONS.includes(wallet.name))
    : wallets;

  if (filteredWallets.length === 0) {
    return (
      <Box>
        <Text>
          No wallets available for {selectedWalletCategory.chain}
        </Text>
      </Box>
    );
  }

  return (
    <>
      {filteredWallets.map((wallet) => (
        <WalletSelector key={wallet.name} provider={wallet} walletCategory={selectedWalletCategory} />
      ))}
    </>
  );
};

export default ChainSelector;

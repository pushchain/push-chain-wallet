import React, { FC } from "react";
import { WalletCategoriesType } from "../../../types/wallet.types";
import { walletRegistry } from "../../../providers/WalletProviderRegistry";
import WalletSelector from "./WalletSelector";
import { Box, deviceSizes, Text } from "blocks";
import { useDeviceWidthCheck } from "common";

interface ChainWalletSelectorProps {
  selectedWalletCategory: WalletCategoriesType;
}

const ChainSelector: FC<ChainWalletSelectorProps> = ({ selectedWalletCategory }) => {
  const isMobile = useDeviceWidthCheck(parseInt(deviceSizes.laptop));
  const wallets = walletRegistry.getProvidersByChain(selectedWalletCategory.chain);
  const filteredWallets = isMobile && wallets.some((wallet) => wallet.name === "MetaMask")
    ? wallets.filter((wallet) => wallet.name === "MetaMask")
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

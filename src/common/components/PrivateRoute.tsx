import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { APP_ROUTES } from "../../constants";
import { useGlobalState } from "../../context/GlobalContext";
import { PushWalletLoadingContent, WalletSkeletonScreen, isUIKitVersion, getAppParamValue } from "common";
import { usePersistedQuery } from "../hooks/usePersistedQuery";

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const {
    state: { walletLoadState, externalWallet, pushWallet, wallet, jwt },
  } = useGlobalState();

  const persistQuery = usePersistedQuery();

  const isOpenedInIframe = !!getAppParamValue();

  if (walletLoadState === "idle" || walletLoadState === "loading") {
    return <WalletSkeletonScreen content={<PushWalletLoadingContent />} />;
  }

  if (walletLoadState === "success" && (
    ((isUIKitVersion('5') || !isOpenedInIframe) ? wallet?.universalSigner.account : jwt) || pushWallet)
  ) {
    return <>{children}</>;
  }

  if (walletLoadState === "success" && externalWallet) {
    return <>{children}</>;
  }

  return <Navigate to={persistQuery(APP_ROUTES.AUTH)} />;
};

export { PrivateRoute };

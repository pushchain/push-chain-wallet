import { useNavigate } from "react-router-dom";
import { useExternalWallet } from "../context/ExternalWalletContext";
import { useGlobalState } from "../context/GlobalContext";
import { APP_ROUTES } from "../constants";
import { getAppParamValue, WALLET_TO_APP_ACTION } from "common";
import { ChainType, IWalletProvider, ExternalWalletType } from "../types/wallet.types";

const isMobileBrowser = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const openInPhantomBrowser = () => {
  const currentUrl = window.location.href;
  const refUrl = window.location.origin;
  const phantomBrowseUrl = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(refUrl)}`;

  window.location.assign(phantomBrowseUrl);
};

export const useConnectExternalWallet = () => {
  const { connect, isWalletInstalled } = useExternalWallet();
  const { dispatch } = useGlobalState();
  const navigate = useNavigate();
  const isOpenedInIframe = !!getAppParamValue();

  const connectWithProvider = async (provider: IWalletProvider, chainType?: ChainType) => {
    const installed = await isWalletInstalled(provider);
    if (!installed) {
      if (!isOpenedInIframe && provider.name === "Phantom" && isMobileBrowser()) {
        openInPhantomBrowser();
        return { ok: true as const };
      }

      return { ok: false, reason: "not_installed" as const };
    }

    if (isOpenedInIframe) {
      window.parent?.postMessage(
        {
          type: WALLET_TO_APP_ACTION.CONNECT_WALLET,
          data: { chain: chainType, provider: provider.name },
        },
        getAppParamValue()
      );
      return { ok: true as const };
    }

    try {
      dispatch({ type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE", payload: "loading" });

      const result = await connect(provider, chainType);

      const payload: ExternalWalletType = {
        originAddress: result,
        chainType: chainType,
        providerName: provider.name,
      };

      if (result) {
        dispatch({ type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE", payload: "success" });
        dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
        dispatch({ type: "SET_EXTERNAL_WALLET", payload });
        navigate(APP_ROUTES.WALLET);
      }

      return { ok: true as const };
    } catch (e) {
      dispatch({ type: "SET_EXTERNAL_WALLET_AUTH_LOAD_STATE", payload: "rejected" });
      return { ok: false as const, reason: "error" as const };
    }
  };

  return { connectWithProvider };
};

import { FC, useEffect, useState } from "react";
import {
  BoxLayout,
  ContentLayout,
  PushWalletLoadingContent,
  WalletSkeletonScreen,
  WalletReconstructionErrorContent,
} from "../../common";
import api from "../../services/api";
import { PushWallet } from "../../services/pushWallet/pushWallet";
import { APP_ROUTES, ENV } from "../../constants";
import secrets from "secrets.js-grempe";
import { useGlobalState } from "../../context/GlobalContext";
import { getWalletlist } from "./Wallet.utils";
import { useLocation, useNavigate } from "react-router-dom";
import { usePersistedQuery } from "../../common/hooks/usePersistedQuery";
import { CreateNewWallet } from "../../common/components/CreateNewWallet";
import WalletDashboard from "./components/dashboard/WalletDashboard";
import AddTokens from "./components/AddTokens";
import { Box, } from "blocks";
import { Receive } from "./components/Receive";
import { Send } from "./components/sendComponent/Send";
import { WalletDashboardProvider } from "../../context/WalletDashboardContext";
import { ActiveStates, PushNetworks, WalletListType } from "src/types";
import { bytesToHex, stringToBytes } from "viem";
import { Reconnect } from "./components/Reconnect";
import WalletRecoveryPhrase from "./components/WalletRecoveryPhrase";

export type WalletProps = Record<string, never>;

const Wallet: FC<WalletProps> = () => {
  const { state, dispatch } = useGlobalState();
  const [createAccountLoading, setCreateAccountLoading] = useState(true);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const externalOrigin = params.get("app");

  const [showConnectionSuccess, setConnectionSuccess] =
    useState<boolean>(false);

  const [showCreateNewWalletModal, setShowCreateNewWalletModal] =
    useState(false);

  const [showReconstructionErrorModal, setShowReconstructionErrorModal] = useState(false);

  // TODO: This needs to go to a top level context
  const [selectedWallet, setSelectedWallet] = useState<WalletListType>();

  const navigate = useNavigate();
  const persistQuery = usePersistedQuery();
  const [activeState, setActiveState] = useState<ActiveStates>('walletDashboard');
  const [selectedNetwork, setSelectedNetwork] = useState<PushNetworks>('Push Testnet Donut');

  const createWalletAndGenerateMnemonic = async (userId: string) => {
    try {
      setCreateAccountLoading(true);
      const instance = await PushWallet.signUp(
        import.meta.env.VITE_APP_ENV as ENV
      );

      const mnemonicHex = bytesToHex(stringToBytes(instance.mnemonic)).replace(/^0x/, "");
      const shares = secrets.share(mnemonicHex, 3, 2);

      // First create the passkeys for storing shard 3
      await instance.storeMnemonicShareAsEncryptedTx(
        userId,
        shares[2],
      );

      await api.post(`/mnemonic-share`, { share: shares[0], type: 'TYPE1' });

      // Store shard in localstorage
      localStorage.setItem(`mnemonicShare2:${userId}`, shares[1]);

      dispatch({ type: "INITIALIZE_WALLET", payload: instance });

      localStorage.setItem(
        "walletInfo",
        JSON.stringify(instance.universalSigner.account)
      );

      setSelectedWallet(
        getWalletlist(instance)[0]
      );

    } catch (err) {
      console.error("Error creating wallet:", err);
      throw err;
    } finally {
      setCreateAccountLoading(false);
    }
  };

  const reconstructWallet = async (share1: string, share2: string) => {
    try {
      setCreateAccountLoading(true);
      const mnemonicHex = secrets.combine([share1, share2]);
      const bytes = new Uint8Array(mnemonicHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const mnemonic = new TextDecoder().decode(bytes);
      const instance = await PushWallet.logInWithMnemonic(
        mnemonic,
        import.meta.env.VITE_APP_ENV as ENV
      );

      dispatch({ type: "INITIALIZE_WALLET", payload: instance });

      localStorage.setItem(
        "walletInfo",
        JSON.stringify(instance.universalSigner.account)
      );

      setSelectedWallet(
        getWalletlist(instance)[0]
      );

    } catch (err) {
      console.error("Error reconstructing wallet:", err);
      throw err;
    } finally {
      setCreateAccountLoading(false);
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      setCreateAccountLoading(true);
      const response = await api.get("/auth/user", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userId = response.data.id;
      dispatch({ type: "SET_USER", payload: response.data });
      dispatch({ type: "SET_AUTHENTICATED", payload: true });

      if (!state.wallet) {
        let share3, share1

        const share2 = localStorage.getItem(`mnemonicShare2:${userId}`);

        try {
          const mnemonicShareResponse = await api.get(
            `/mnemonic-share`);

          const sharesArray = mnemonicShareResponse.data

          if (!sharesArray.length) {
            throw new Error('No shares Found')
          }

          share1 = sharesArray.find((share) => share.type === "TYPE1").share;

          if (share1 && share2) {
            await reconstructWallet(share1, share2);
            return;
          }

          // Find share3 if only single share is present
          if (!share1 || !share2) {
            try {
              share3 = sharesArray.find((share) => share.type === 'TYPE2').share;

              share3 = await PushWallet.retrieveMnemonicShareFromTx(
                import.meta.env.VITE_APP_ENV as ENV,
                userId,
                share3
              );

              if (share1 && share3) {
                await reconstructWallet(share1, share3);
                return;
              }

              if (share2 && share3) {
                await reconstructWallet(share2, share3);
                return;
              }
            } catch (error) {
              console.debug("Share3 not available", {
                userId,
                error: (error as Error).message,
              });
            }
          }


        } catch (error) {
          console.debug("Share1 not available", {
            userId,
            error: (error as Error).message,
          });
        }

        // Only single or no share is found directly ask user if they want to create a new wallet or go back
        const hasAnyShare = share1 || share2 || share3;

        if (hasAnyShare) {
          setShowReconstructionErrorModal(true);
          return;
        } else {
          // User has no share as them to create a new wallet.
          setShowCreateNewWalletModal(true);
        }

      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      handleResetAndRedirectUser();
      throw err;
    } finally {
      setCreateAccountLoading(false);
    }
  };

  useEffect(() => {
    const initializeProfile = async () => {
      try {
        if (state.jwt && !state.isReadOnly) {
          setCreateAccountLoading(true);

          await fetchUserProfile(state.jwt);
        }
      } catch (err) {
        console.error("Error initializing profile:", err);
        handleResetAndRedirectUser();
      } finally {
        setCreateAccountLoading(false);
      }
    };

    initializeProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isReadOnly]);

  const handleCreateNewWallet = async () => {
    try {
      await createWalletAndGenerateMnemonic(state.user.id);
    } catch (error) {
      handleResetAndRedirectUser();
    } finally {
      setShowCreateNewWalletModal(false);
      setShowReconstructionErrorModal(false);
    }
  };

  const handleResetAndRedirectUser = () => {
    sessionStorage.removeItem("jwt");
    dispatch({ type: "RESET_WALLET" });
    localStorage.removeItem('appConnections');
    const url = persistQuery(APP_ROUTES.AUTH);
    navigate(url);
  };

  useEffect(() => {
    if (state?.wallet?.universalSigner.account.address)
      setSelectedWallet(
        getWalletlist(state.wallet)[0]
      );
  }, [state?.wallet?.universalSigner]);

  useEffect(() => {
    if (
      externalOrigin &&
      state.externalWallet &&
      state.externalWalletAppConnectionStatus === "connected"
    )
      setConnectionSuccess(true);
  }, [externalOrigin, state?.externalWalletAppConnectionStatus, state.externalWallet]);

  if (createAccountLoading)
    return (
      <WalletSkeletonScreen content={<PushWalletLoadingContent />} />
    );

  if (showReconstructionErrorModal)
    return (
      <WalletSkeletonScreen
        content={
          <WalletReconstructionErrorContent
            onSuccess={handleCreateNewWallet}
            onError={handleResetAndRedirectUser}
          />
        }
      />
    );

  if (showCreateNewWalletModal)
    return (
      <WalletSkeletonScreen
        content={
          <CreateNewWallet
            onSuccess={handleCreateNewWallet}
            onError={handleResetAndRedirectUser}
          />
        }
      />
    );

  return (
    <ContentLayout>
      <BoxLayout>
        <Box
          flexDirection="column"
          display="flex"
          width={{ initial: "376px", ml: "100%" }}
          height={{ initial: "auto", ml: "100%" }}
          padding="spacing-md"
          gap="spacing-sm"
          position="relative"
        >
          <WalletDashboardProvider
            selectedWallet={selectedWallet}
            setSelectedWallet={setSelectedWallet}
            showConnectionSuccess={showConnectionSuccess}
            setConnectionSuccess={setConnectionSuccess}
            activeState={activeState}
            setActiveState={setActiveState}
            selectedNetwork={selectedNetwork}
            setSelectedNetwork={setSelectedNetwork}
          >
            {activeState === 'walletDashboard' && <WalletDashboard />}
            {activeState === 'addTokens' && <AddTokens />}
            {activeState === 'receive' && <Receive />}
            {activeState === 'send' && <Send />}
            {activeState === 'recoveryPhrase' && <WalletRecoveryPhrase />}
            <Reconnect />
          </WalletDashboardProvider>
        </Box>
      </BoxLayout>
    </ContentLayout>
  );
};

export { Wallet };

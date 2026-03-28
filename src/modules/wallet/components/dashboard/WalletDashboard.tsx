import React, { FC, useMemo } from 'react';
import { Info } from 'blocks';
import { DrawerWrapper, ErrorContent, getAppParamValue, LoadingContent, LoadingScreen, PushWalletAppConnection, PushWalletLoadingContent } from 'common';
import { WalletProfile } from './WalletProfile';
import { WalletTabs } from './WalletTabs';
import { getWalletlist } from '../../Wallet.utils';
import { ConnectionSuccess } from '../../../../common/components/ConnectionSuccess';
import { useGlobalState } from '../../../../context/GlobalContext';
import { useWalletDashboard } from '../../../../context/WalletDashboardContext';
import { usePushChain } from '../../../../hooks/usePushChain';

const WalletDashboard: FC = () => {
    const { state, dispatch } = useGlobalState();
    const {
        selectedWallet,
        setSelectedWallet,
        showConnectionSuccess,
        setConnectionSuccess,
        setActiveState
    } = useWalletDashboard();

    const { executorAddress, isLoading } = usePushChain();

    const walletList = useMemo(() => getWalletlist(state.wallet), [state.wallet]);

    if (isLoading)
        return (
            <LoadingScreen content={<PushWalletLoadingContent />} />
        );

    return (
        <>
            <PushWalletAppConnection selectedWallet={selectedWallet} />
            <WalletProfile walletAddress={executorAddress} />

            <WalletTabs
                walletList={walletList}
                walletAddress={executorAddress}
                selectedWallet={selectedWallet}
                setSelectedWallet={setSelectedWallet}
                setActiveState={setActiveState}
            />
            {/* {!state?.wallet && primaryWallet && (
            <CreateAccount
              isLoading={createAccountLoading}
              setIsLoading={setCreateAccountLoading}
            />
          )} */}
            {state.messageSignState === "loading" && (
                <DrawerWrapper>
                    <LoadingContent
                        title={"Processing Transaction"}
                        subTitle={"Your transaction is being verified"}
                    />
                </DrawerWrapper>
            )}

            {state.messageSignState === "rejected" && (
                <DrawerWrapper>
                    <ErrorContent
                        icon={<Info size={32} color="pw-int-icon-danger-bold-color" />}
                        title="Could not verify"
                        subTitle="Please try again"
                        onClose={() =>
                            dispatch({ type: "SET_MESSAGE_SIGN_STATE", payload: "idle" })
                        }
                    />
                </DrawerWrapper>
            )}
            {showConnectionSuccess && getAppParamValue() && (
                <DrawerWrapper>
                    <ConnectionSuccess
                        onClose={() => {
                            setConnectionSuccess(false);
                        }}
                    />
                </DrawerWrapper>
            )}
                    </>
    );
};

export default WalletDashboard;
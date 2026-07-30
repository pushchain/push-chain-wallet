import {
    Asterisk,
    Back,
    Box,
    CopyFilled,
    Dropdown,
    Logout,
    Menu,
    MenuItem,
    Settings,
    Text,
    TickCircleFilled,
    Connector,
    Cross,
    deviceSizes,
} from "blocks";
import {
    centerMaskWalletAddress,
    CHAIN_MONOTONE_LOGO,
    EXPLORER_URL,
    getAppParamValue,
    handleCopy,
    isUIKitVersion,
    useDeviceWidthCheck,
    usePersistedQuery,
    WALLET_TO_APP_ACTION,
} from "common";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../../../../constants";
import { useEventEmitterContext } from "../../../../context/EventEmitterContext";
import { useGlobalState } from "../../../../context/GlobalContext";
import { useExternalWallet } from "../../../../context/ExternalWalletContext";
import styled, { css } from "styled-components";
import { FC, useState } from "react";
import { useWalletDashboard } from "../../../../context/WalletDashboardContext";
import { convertCaipToObject } from "../../Wallet.utils";
import { useWaapAuth } from "../../../../waap/useWaapAuth";
import { Jazzicon } from "../../../../common/components/JazzIcon";
import { getAddressExplorerUrl } from "../../../../utils/explorer";

type WalletHeaderProps = {
    walletAddress: string;
    handleBackButton?: () => void;
};

const WalletHeader: FC<WalletHeaderProps> = ({ walletAddress, handleBackButton }) => {
    const { state, dispatch } = useGlobalState();
    const { activeState, setActiveState } = useWalletDashboard();

    const { disconnect } = useExternalWallet();
    const navigate = useNavigate();
    const persistQuery = usePersistedQuery();
    const { handleLogOutEvent } = useEventEmitterContext();
    const { logoutWaap } = useWaapAuth();

    const isOpenedInIframe = !!getAppParamValue();

    const showCloseButton = isUIKitVersion('1');

    const isMobile = useDeviceWidthCheck(parseInt(deviceSizes.mobileM));

    const handleLogOut = () => {
        dispatch({ type: "RESET_WALLET" });

        disconnect();

        sessionStorage.removeItem("jwt");
        localStorage.removeItem("pw_user_email");
        localStorage.removeItem("walletInfo");

        navigate(persistQuery(APP_ROUTES.AUTH));

        logoutWaap();

        if (isOpenedInIframe) {
            handleLogOutEvent();
        }
    };

    const handleClose = () => {
        window.parent.postMessage(
            { type: WALLET_TO_APP_ACTION.CLOSE_IFRAME },
            '*'
        );
    };

    const originAddress = state.externalWallet && state.externalWallet.originAddress ? convertCaipToObject(state.externalWallet.originAddress).result : null;

    return (
        <Box
            display="flex"
            justifyContent={activeState === "walletDashboard" ? "space-between" : "flex-start"}
            alignItems="center"
            width={{initial: showCloseButton ? "90%" : "100%", mm: "100%"}}
            gap="spacing-xxs"
        >
            {handleBackButton && (
                <Box cursor="pointer" display='flex' alignItems='center' height='100%'>
                    <Back
                        size={24}
                        color="pw-int-icon-primary-color"
                        onClick={handleBackButton}
                    />
                </Box>
            )}

            {activeState === 'receive' && (
                <Box
                    textAlign='center'
                    css={css`flex:1`}
                >
                    <Text variant="h3-semibold">Receive Address</Text>
                </Box>
            )}

            {activeState !== 'receive' && <Box display="flex" gap="spacing-xs">
                <Box
                    position="relative"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    <Box
                        width="44px"
                        height="44px"
                        borderRadius="radius-xl"
                        overflow="hidden"
                        alignSelf="center"
                    >
                        <Jazzicon address={walletAddress} size={44} />
                    </Box>
                </Box>

                <Box gap="spacing-xxxs" display="flex" flexDirection="column" justifyContent="center" alignItems="flex-start">
                    {(!originAddress || originAddress.address === walletAddress) && (
                        <Text variant="bes-semibold">Push Chain Wallet</Text>
                    )}
                    <WalletAddress address={walletAddress} chainId={42101} type='executor' />

                    {originAddress && originAddress.address !== walletAddress && (
                        <WalletAddress address={originAddress.address} chainId={originAddress.chainId} type='origin' />
                    )}
                </Box>
            </Box>}

            {activeState === "walletDashboard" && (
                <Dropdown
                    css={css`
                        z-index: 3;
                    `}
                    side='bottom'
                    align='end'
                    overlay={
                        <Menu>
                            {state.wallet && (<MenuItem
                                label="Secret Recovery Phrase"
                                icon={<Asterisk />}
                                onClick={() => {
                                    (isUIKitVersion('5') || !isOpenedInIframe)
                                        ? window.open('https://waap.xyz/settings/privacy-and-security/export-key', '_blank')
                                        : setActiveState("recoveryPhrase");
                                }}
                            />)}
                            <MenuItem
                                label="Log Out"
                                icon={<Logout size={24} color="pw-int-icon-primary-color" />}
                                onClick={() => {
                                    handleLogOut();
                                }}
                            />
                            {isMobile && showCloseButton && (<MenuItem
                                label="Minimize"
                                icon={<Cross size={24} color="pw-int-icon-primary-color" />}
                                onClick={() => {
                                    handleClose();
                                }}
                            />)}
                        </Menu>
                    }
                >
                    <Box 
                        cursor="pointer"
                    >
                        <Settings size={24} color="pw-int-icon-primary-color" />
                    </Box>
                </Dropdown>
            )}
        </Box>
    );
};

export default WalletHeader;

const WalletAddress: FC<{ address: string; chainId: string | number | null, type: 'executor' | 'origin' }> = ({ address, chainId, type }) => {
    const [copied, setCopied] = useState(false);

    const resolvedChainId = chainId ?? 42101;
    const IconComponent = CHAIN_MONOTONE_LOGO[resolvedChainId];
    const explorerUrl =
        type === 'origin'
            ? getAddressExplorerUrl(resolvedChainId, address)
            : `${EXPLORER_URL}/address/${address}`;
    
    return (
        <AddressRow
            display="flex"
            gap="spacing-xxxs"
            css={css`
                padding-left: ${type === 'origin' ? '8px' : '0'};
            `}
        >
            {type === 'origin' && <Connector size={12} />}
            <Box
                display="flex"
                gap="spacing-xxxs"
                justifyContent="center"
                alignItems="center"
            >
                <Box
                    display='flex'
                    cursor='pointer'
                    gap="spacing-xxs"
                    justifyContent="center"
                    alignItems="center"
                    onClick={() => window.open(explorerUrl, "_blank")}
                >
                    <IconComponent size={20} />
                    <Text
                        variant="bes-regular"
                        textTransform="inherit"
                        color={type === 'executor' ? "pw-int-text-primary-color" : "pw-int-text-tertiary-color"}
                        css={css`
                            &:hover {
                                color: ${ type === 'executor' ? 'var(--pw-int-brand-primary-color)' : 'var(--pw-int-brand-primary-subtle-color)'};
                            }    
                        `}
                    >
                        {centerMaskWalletAddress(address, 5)}
                    </Text>
                </Box>
                <Box
                    cursor="pointer"
                    display='flex'
                    className="copy-icon"
                >

                    {copied ? (
                        <TickCircleFilled
                            autoSize
                            size={12}
                            color="pw-int-icon-success-bold-color"
                        />
                    ) : (
                        <CopyFilled
                            color="pw-int-icon-tertiary-color"
                            size={12}
                            onClick={() => handleCopy(address, setCopied)}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--pw-int-icon-brand-color)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--pw-int-icon-tertiary-color)')}
                        />
                    )}
                </Box>
            </Box>
        </AddressRow>
    );
}

const AddressRow = styled(Box)`
  .copy-icon {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  &:hover .copy-icon {
    opacity: 1;
    pointer-events: auto;
  }
`;

import { FC } from "react";
import { Box, Button, Text, TextInput, Front } from "../../../blocks";
import { DrawerWrapper, getAppParamValue, LoadingContent, PoweredByPush, getVersionParamValue, isUIKitVersion } from "../../../common";
import { WalletState, SocialProvider } from "../Authentication.types";
import { APP_ROUTES } from "../../../constants";
import { usePersistedQuery } from "../../../common/hooks/usePersistedQuery";
import { WalletConfig } from "src/types/wallet.types";
import styled from "styled-components";
import { trimText } from "../../../helpers/AuthHelper";
import { useWaapAuth } from "../../../waap/useWaapAuth";
import { PushChain } from '@pushchain/core';
import { useGlobalState } from "../../../context/GlobalContext";
import {
  waapSignMessage,
  waapSignTypedData,
  waapSignAndSendTransaction,
} from '../../../waap/waapProvider';
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import {
  getAuthWindowConfig,
  getOTPEmailAuthRoute,
  getPushSocialAuthRoute,
} from "../Authentication.utils";

export type LoginProps = {
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setConnectMethod: React.Dispatch<React.SetStateAction<WalletState>>;
  walletConfig: WalletConfig
};

const validationSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email address").required("Required"),
});

const Login: FC<LoginProps> = ({ email, setEmail, setConnectMethod, walletConfig }) => {
  const persistQuery = usePersistedQuery();
  const { loading, loginWithWaapSocial, tryAutoConnect, setLoading } = useWaapAuth();
  const { state, dispatch } = useGlobalState();

  const navigate = useNavigate();

  const isOpenedInIframe = !!getAppParamValue();

  const formik = useFormik({
    initialValues: { email },
    validationSchema,
    onSubmit: (values) => {
      setEmail(values.email);
      localStorage.setItem("pw_user_email", values.email);

      if (values.email) {
        if (isOpenedInIframe) {

          const appURL = getAppParamValue();
          const version = getVersionParamValue();
          sessionStorage.setItem('App_Connections', appURL);
          sessionStorage.setItem('UI_kit_version', version);

          window.location.href = getOTPEmailAuthRoute(
            values.email,
            APP_ROUTES.VERIFY_EMAIL_OTP
          );

        } else {
          window.location.href = getOTPEmailAuthRoute(
            values.email,
            persistQuery(APP_ROUTES.VERIFY_EMAIL_OTP)
          );

        }
      }
    }
  });

  const handleSocialLogin = (provider: SocialProvider) => {
    if (isOpenedInIframe) {
      const backendURL = getPushSocialAuthRoute(
        provider,
        APP_ROUTES.OAUTH_REDIRECT
      );
      window.open(backendURL, "Google OAuth", getAuthWindowConfig());
    } else {
      window.location.href = getPushSocialAuthRoute(
        provider,
        persistQuery(APP_ROUTES.WALLET)
      );
    }
  };

  const handleLogin = async (addr: `0x${string}`) => {
    const w = await PushChain.utils.account.convertExecutorToOriginAccount(addr);

    const instance = {
      universalSigner: {
        signMessage: waapSignMessage,
        signTypedData: waapSignTypedData,
        signAndSendTransaction: waapSignAndSendTransaction,
        account: w.account
      }
    }

    dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
    dispatch({ type: "INITIALIZE_WALLET", payload: instance });

    localStorage.setItem(
      "walletInfo",
      JSON.stringify(w.account)
    );

    
    navigate(`${persistQuery(APP_ROUTES.WALLET)}`, {
      replace: true,
    });
  }

  const handleWaapSocialLogin = async () => {
    const result = await loginWithWaapSocial();
    if (!result) return;

    await handleLogin(result.address as `0x${string}`);

    setLoading(false);
  };

  const handleReconnect = async () => {
    if (state?.wallet) return;

    const res = await tryAutoConnect();
    if (!res?.address) return;

    await handleLogin(res.address as `0x${string}`);
  };

  // useEffect(() => {
  //   handleReconnect();
  // }, []);

  const hasBasic =
    !!walletConfig?.loginDefaults?.email ||
    !!walletConfig?.loginDefaults?.google ||
    !!walletConfig?.loginDefaults?.phone;

  const hasSocials =
    !!walletConfig?.loginDefaults?.socials &&
    Object.values(walletConfig?.loginDefaults?.socials).some(Boolean);

  const showEmailLogin = isOpenedInIframe ? walletConfig?.loginDefaults.email : true
  const showGoogleLogin = isOpenedInIframe ? walletConfig?.loginDefaults.google : true
  const showWalletLogin = isOpenedInIframe ? walletConfig?.loginDefaults.wallet.enabled : true
  const showWaapLogin = isOpenedInIframe ? ( hasBasic || hasSocials ) : true

  return (
    <Box
      alignItems="center"
      flexDirection="column"
      display="flex"
      justifyContent="space-between"
      width="100%"
      gap={walletConfig?.appMetadata ? "spacing-md" : "spacing-xl"}
      margin="spacing-md spacing-none spacing-none spacing-none"
    >
      <Text variant="h3-semibold" color="pw-int-text-primary-color">
        {" "}
        Log in or Sign up
      </Text>
      {walletConfig?.loginDefaults?.appPreview && walletConfig?.appMetadata && (
        <Box
          display='flex'
          gap='spacing-xs'
          alignItems='center'
          flexDirection='column'
        >
          {walletConfig?.appMetadata?.logoURL && <Box
            width="64px"
            height="64px"
          >
            <Image
              src={walletConfig.appMetadata.logoURL}
            />
          </Box>}
          <Box
            display='flex'
            flexDirection='column'
            gap='spacing-xxs'
            alignSelf='stretch'
            alignItems='center'
          >
            <Text
              variant="bl-semibold"
              color="pw-int-text-primary-color"
            >
              {walletConfig.appMetadata.title}
            </Text>
            <Text
              variant="bm-regular"
              color="pw-int-text-secondary-color"
              textAlign="center"
            >
              {trimText(walletConfig.appMetadata.description, 15)}
            </Text>
          </Box>

        </Box>
      )}

      <Box
        flexDirection="column"
        display="flex"
        gap="spacing-lg"
        width="100%"
        alignItems="center"
      >
        <Box
          flexDirection="column"
          display="flex"
          gap="spacing-xs"
          width="100%"
          alignItems="center"
        >
          {
            (isUIKitVersion('5') || !isOpenedInIframe) ? (
              <>
                {showWaapLogin && (
                  <Button
                    variant="outline"
                    block
                    onClick={handleWaapSocialLogin}
                  >
                    Continue with Social login
                  </Button>
                )}
                {(showWaapLogin && showWalletLogin) && (<Text variant="os-regular" color="pw-int-text-tertiary-color">
                  OR
                </Text>)}
              </>
            ) : (
              <>
                {showEmailLogin && (
                  <>
                    <Box width="100%">
                      <form onSubmit={formik.handleSubmit}>
                        <TextInput
                          value={formik.values.email}
                          onChange={formik.handleChange("email")}
                          placeholder="Enter your email"
                          error={formik.touched?.email && Boolean(formik.errors?.email)}
                          errorMessage={formik.touched?.email ? formik.errors?.email : ""}
                          trailingIcon={
                            <Front
                              size={24}
                              onClick={() => {
                                formik.handleSubmit();
                                setConnectMethod("social");
                              }}
                            />
                          }
                        />
                      </form>
                    </Box>
                  </>
                )}
                {showEmailLogin && showGoogleLogin && (<Text variant="os-regular" color="pw-int-text-tertiary-color">
                  OR
                </Text>)}
                {showGoogleLogin && (
                  <>
                    <Button
                      variant="outline"
                      block
                      onClick={() => handleSocialLogin('google')}
                    >
                      Continue with Google
                    </Button>
                  </>
                )}

                {((showGoogleLogin && showWalletLogin) || (showEmailLogin && showWalletLogin)) && (<Text variant="os-regular" color="pw-int-text-tertiary-color">
                  OR
                </Text>)}
              </>
            )
          }

          {showWalletLogin && <Button
            variant="outline"
            block
            onClick={() => setConnectMethod("connectWallet")}
          >
            Continue with a Wallet
          </Button>}
        </Box>
        {/* TODO: after functional implementation */}
        {/* <Text variant="bes-semibold" color="text-brand-medium">
          Recover using Secret Key{" "}
        </Text> */}
        {(isUIKitVersion('5') || !isOpenedInIframe) && loading && (<DrawerWrapper>
          <LoadingContent
              title={"Verifying..."}
              subTitle={"FInishing signing up in the new window to continue..."}
          />
        </DrawerWrapper>)}
      </Box>
      <PoweredByPush />
    </Box>
  );
};

export { Login };

const Image = styled.img`
  width:inherit;
  height:inherit;
  border-radius: 16px;
  border: 1px solid var(--pw-int-border-secondary-color, #313338);
`
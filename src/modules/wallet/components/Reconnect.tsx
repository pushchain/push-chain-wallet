import { Reauthentication } from "./Reauthentication";
import { DrawerWrapper } from "../../../common/components";
import { getAppParamValue, isUIKitVersion } from "../../../common/Common.utils";
import { useGlobalState } from "../../../context/GlobalContext";
import { useEventEmitterContext } from "../../../context/EventEmitterContext";
import { useState, useEffect } from "react";
import { OTPReverification } from "./OTPReverification";
import { WALLET_TO_WALLET_ACTION } from "../../../common/Common.types";

export interface AuthParams {
    state: string;
    challengeId: string;
    email: string;
}

const Reconnect = () => {
    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [params, setparams] = useState<AuthParams | null>(null);

    const isOpenedInIframe = !!getAppParamValue();
    const { handleCancelAppConnection } = useEventEmitterContext();

    const {state, dispatch} = useGlobalState();

    useEffect(() => {
        if (isUIKitVersion("5")) return;
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return;

            const { type, params } = e.data || {};
            if (type === WALLET_TO_WALLET_ACTION.REAUTH_PARAM) {
                setparams(params);
                setShowEmailLogin(true);
                dispatch({ type: "SET_RECONNECT", payload: false });
            }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [])

    if (!isOpenedInIframe) {
        return;
    }

    return (
        <>
            {(isUIKitVersion('5') || !isOpenedInIframe) ? (
                <>
                    {state.reconnect && (
                        <DrawerWrapper>
                            <Reauthentication onCancel={() => handleCancelAppConnection()} />
                        </DrawerWrapper>
                    )}
                </>
            ) : (
                <>
                    {state.reconnect && !showEmailLogin && (
                        <DrawerWrapper>
                            <Reauthentication onCancel={() => handleCancelAppConnection()} />
                        </DrawerWrapper>
                    )}
                    {showEmailLogin && params && (
                        <DrawerWrapper>
                            <OTPReverification
                                params={params}
                                onClose={() => setShowEmailLogin(false)} 
                                onCancel={() => handleCancelAppConnection()}/>
                        </DrawerWrapper>
                    )}
                </>
            )}
        </>
    );
}

export {Reconnect};
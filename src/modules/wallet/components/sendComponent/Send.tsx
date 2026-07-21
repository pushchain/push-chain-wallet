import { Box } from 'blocks';
import React from 'react';
import { SelectToken } from './SelectToken';
import SelectRecipient from './SelectRecipient';
import Review from './Review';
import Confirmation from './Confirmation';
import { SendTokenProvider, TokenDetails, useSendTokenContext } from '../../../../context/SendTokenContext';
import {
    buildSendEventMetadata,
    trackWalletEvent,
    WALLET_EVENTS,
} from '../../../../analytics/walletEvents';

const SendContent = () => {
    const {
        sendState,
        setSendState,
        setTokenDetails,
        walletAddress,
    } = useSendTokenContext();

    const handleTokenSelection = (tokenDetails: TokenDetails) => {
        const metadata = buildSendEventMetadata({
            walletAddress,
            tokenDetails,
        });
        trackWalletEvent(WALLET_EVENTS.SEND_TOKEN_SELECTED, {
            ...metadata,
            step: 'token_selected',
        });
        setTokenDetails(tokenDetails);
        setSendState('selectRecipient');
    }

    return (
        <Box
            flexDirection="column"
            display="flex"
            height={{ initial: "570px", ml: "100%" }}
            gap="spacing-md"
            position="relative"
        >
            {sendState === 'selectToken' && <SelectToken handleTokenSelection={handleTokenSelection} />}
            {sendState === 'selectRecipient' && <SelectRecipient />}
            {sendState === 'review' && <Review />}
            {sendState === 'confirmation' && <Confirmation />}
        </Box>
    );
};

type SendProps = {
    initialTokenDetails?: TokenDetails | null;
};

const Send = ({ initialTokenDetails }: SendProps) => {
    return (
        <SendTokenProvider initialTokenDetails={initialTokenDetails}>
            <SendContent />
        </SendTokenProvider>
    );
};

export { Send };

import { Box } from 'blocks';
import React from 'react';
import { SelectToken } from './SelectToken';
import SelectRecipient from './SelectRecipient';
import Review from './Review';
import Confirmation from './Confirmation';
import { TokenFormat } from '../../../../types';
import { SendTokenProvider, useSendTokenContext } from '../../../../context/SendTokenContext';

const SendContent = () => {
    const { sendState, setTokenSelected, setSendState } = useSendTokenContext();

    const handleTokenSelection = (token: TokenFormat) => {
        setTokenSelected(token);
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
    initialToken?: TokenFormat | null;
};

const Send = ({ initialToken }: SendProps) => {
    return (
        <SendTokenProvider initialToken={initialToken}>
            <SendContent />
        </SendTokenProvider>
    );
};

export { Send };
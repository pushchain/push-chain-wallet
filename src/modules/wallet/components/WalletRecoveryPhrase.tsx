import { Box, Button, Copy, Text, TickCircleFilled } from "blocks";
import { useEffect, useState } from "react";
import { useGlobalState } from "../../../context/GlobalContext";
import { css } from "styled-components";
import { handleCopy, isClassicPushWallet, isUIKitVersion, getAppParamValue } from "common";
import { useWalletDashboard } from '../../../context/WalletDashboardContext';

const WalletRecoveryPhrase = () => {
    const [phrase, setPhrase] = useState([]);
    const [copied, setCopied] = useState(false);

    const { state } = useGlobalState();
    const { setActiveState } = useWalletDashboard();

    const isOpenedInIframe = !!getAppParamValue();

    useEffect(() => {
        if (isUIKitVersion('5') || !isOpenedInIframe) return;
        if (isClassicPushWallet(state.wallet)) {
            const words = state.wallet.mnemonic.split(" ");
            setPhrase(words);
        }
    }, [state.wallet])
    
    return (
        <Box
            display='flex'
            flexDirection='column'
            css={css`
                gap: 180px;    
            `}
        >
            <Box
                display='flex'
                flexDirection='column'
                gap='spacing-md'
            >
                <Box
                    display='flex'
                    flexDirection='column'
                    padding='spacing-md spacing-none spacing-none spacing-none'
                    gap='spacing-xxxs'
                    textAlign='center'
                >
                    <Text variant='h4-semibold'>Write down your Secret Recovery Phrase</Text>
                    <Box padding='spacing-none spacing-md'>
                        <Text variant='bs-regular' color='pw-int-text-tertiary-color'>
                            Write down this 24-word Secret Recovery Phrase and save it in a secure place.
                        </Text>
                    </Box>
                </Box>
                <Box
                    display='flex'
                    flexDirection='column'
                    padding='spacing-none spacing-xxxs'
                    gap='spacing-xs'
                >
                    <Box
                        borderRadius='radius-sm'
                        padding='spacing-xs'
                        backgroundColor='pw-int-bg-primary-color'
                        display='grid'
                        css={css`
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            row-gap: 10px;
                            column-gap: 40px;
                        `}
                    >
                        {phrase.map((row, index) => (
                            <Text variant='bes-semibold'>{index + 1}. {row}</Text>
                        ))}
                    </Box>
                    <Box
                        display='flex'
                        gap='spacing-xxxs'
                        justifyContent='flex-end'
                        cursor='pointer'
                        onClick={() => {
                            if (isClassicPushWallet(state.wallet)) {
                                handleCopy(state.wallet.mnemonic, setCopied);
                            }
                        }}
                    >
                        {copied ? (
                            <TickCircleFilled size={12} color="pw-int-icon-success-bold-color" />
                        ) : (
                            <Copy size={12} />
                        )}
                        <Text variant='cs-semibold' color='pw-int-brand-primary-color'>
                            Copy to clipboard
                        </Text>
                    </Box>
                </Box>
            </Box>
            <Button block onClick={() => setActiveState('walletDashboard')}>
                Back to Home
            </Button>
        </Box>
    );
}

export default WalletRecoveryPhrase;
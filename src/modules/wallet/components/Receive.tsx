import { Box, Button, Copy, PushChainLogo, Text, TickCircleFilled } from 'blocks';
import React, { useState, useEffect } from 'react';
import WalletHeader from './dashboard/WalletHeader';
import styled, { css } from 'styled-components';
import { useWalletDashboard } from '../../../context/WalletDashboardContext';
import { QRCodeSVG } from 'qrcode.react';
import { usePushChain } from '../../../context/PushChainContext';

const Receive = () => {
    const { setActiveState } = useWalletDashboard();
    const [isCopied, setIsCopied] = useState(false);

    const { executorAddress } = usePushChain();

    const handleCopyAddress = () => {
        if (executorAddress) {
            navigator.clipboard.writeText(executorAddress);
            setIsCopied(true);
        }
    };

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isCopied) {
            timeout = setTimeout(() => {
                setIsCopied(false);
            }, 3000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [isCopied]);



    return (
        <Box
            flexDirection="column"
            display="flex"
            height={{ initial: "570px", ml: "100%" }}
            gap="spacing-md"
            position="relative"
        >
            <WalletHeader walletAddress={executorAddress} handleBackButton={() => setActiveState('walletDashboard')} />

            <Box
                display='flex'
                flexDirection='column'
                alignItems='center'
                justifyContent='center'
                gap='spacing-md'
                css={css`flex:1`}
            >
                <Box
                    display='flex'
                    padding='spacing-sm'
                    borderRadius='radius-md'
                    border='border-sm solid pw-int-border-tertiary-color'
                    backgroundColor='pw-int-bg-primary-color'
                    position='relative'
                >
                    <QRCodeSVG
                        value={executorAddress}
                        size={164}
                    />

                    <LogoContainer>
                        <PushChainLogo />
                    </LogoContainer>
                </Box>
                <Box
                    display='flex'
                    flexDirection='column'
                    alignItems='center'
                    justifyContent='center'
                    gap='spacing-xs'
                    width='100%'
                    css={css`flex:1`}
                >
                    <Text color='pw-int-text-primary-color' variant='h4-semibold'>Push Address</Text>

                    <Box
                        padding='spacing-xs'
                        alignSelf='stretch'
                        borderRadius='radius-xs'
                        backgroundColor='pw-int-bg-primary-color'
                        border='border-sm solid pw-int-border-tertiary-color'
                    >
                        <Text variant='bs-semibold' wrap>{executorAddress}</Text>
                    </Box>

                    <Box
                        display='flex'
                        gap='spacing-xxxs'
                        justifyContent='center'
                        alignItems='center'
                        padding='spacing-xxxs'
                        onClick={handleCopyAddress}
                        cursor='pointer'
                    >
                        {isCopied ? (
                            <TickCircleFilled color='pw-int-icon-brand-color' size={20} />
                        ) : (
                            <Copy color='pw-int-icon-brand-color' size={18} />
                        )}
                        <Text variant='h6-semibold' color='pw-int-text-link-color'>
                            {isCopied ? 'Address Copied!' : 'Copy Address'}
                        </Text>
                    </Box>
                    <Text variant='c-regular' color='pw-int-text-tertiary-color' textAlign='center'>
                        Only send to Push chain addresses. Other networks may result in lost tokens
                    </Text>
                    <Box
                        css={css`flex:1`}
                        display='flex'
                        alignItems='end'
                        width='100%'
                    >

                        <Button block onClick={() => setActiveState('walletDashboard')}>Close</Button>
                    </Box>
                </Box>

            </Box>

        </Box>
    );
};

export { Receive };

const LogoContainer = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
`

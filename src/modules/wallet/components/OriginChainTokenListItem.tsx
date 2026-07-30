import { Box, Faucet, Text } from 'blocks';
import { getChainIcon, modifyAddress } from 'common';
import { css } from 'styled-components';
import { useState, useEffect } from 'react';
import { getNativeTokenBalance } from '../Wallet.utils';

const OriginChainTokenListItem = ({
    token,
    walletDetail,
    showFaucet = false,
}) => {

    const [balance, setBalance] = useState('0');

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await getNativeTokenBalance(token, walletDetail);
                setBalance(res.balance || '0');
            } catch (error) {
                console.error("Error fetching balance:", error);
                setBalance('0');
            }
        };

        if (token && walletDetail) {
            fetchBalance();
        }
    }, [token, walletDetail]);

    const [faucetHovered, setFaucetHovered] = useState(false);

    return (
        <Box
            display='flex'
            justifyContent='space-between'
        >
            <Box
                display='flex'
                gap="spacing-xxs"
                alignItems='center'
            >
                <Box position="relative" width="36px" height="36px" display="inline-block">
                    {getChainIcon(walletDetail.chainId, 36)}
                    <Box
                        position="absolute"
                        width="18px"
                        height="18px"
                        backgroundColor="pw-int-bg-primary-color"
                        borderRadius="radius-lg"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        border="border-sm solid pw-int-border-secondary-color"
                        css={css`
                                bottom: 0;
                                right: 0;
                            `}
                    >
                        {getChainIcon(walletDetail.chainId, 16)}
                    </Box>
                </Box>
                <Box
                    display='flex'
                    flexDirection='column'
                >
                    <Text variant='h5-semibold' color='pw-int-text-primary-color'>{token.name}</Text>
                    <Box
                        display='flex'
                        gap="spacing-xxxs"
                    >
                        <Text variant='h6-regular' color='pw-int-text-secondary-color'>
                            {modifyAddress(balance, 3)} {token.symbol}
                        </Text>
                        {showFaucet && (
                            <Box
                                display='flex'
                                alignItems='center'
                                borderRadius='radius-xs'
                                backgroundColor='pw-int-bg-tertiary-color'
                                padding='spacing-none spacing-xxxs'
                                gap='spacing-xxxs'
                                cursor='pointer'
                                position='relative'
                                onMouseEnter={() => setFaucetHovered(true)}
                                onMouseLeave={() => setFaucetHovered(false)}
                            >
                                <Faucet size={16} color='pw-int-icon-primary-color' />
                                {faucetHovered && (
                                    <Text textTransform="capitalize" color="pw-int-text-tertiary-color" css={css`margin-left: 4px;`}>
                                        Use for Gas
                                    </Text>
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* <Box>
                <Text variant='h5-semibold'>$3,225.21</Text>
                <Text textAlign='right'>-$125.37</Text>
            </Box> */}
        </Box>
    );
};

export { OriginChainTokenListItem };

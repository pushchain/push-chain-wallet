import React from 'react';
import { TOKEN_LOGO } from '../Common.constants';
import { Box, Text } from 'blocks';
import { css } from 'styled-components';
import { getChainIcon } from './ChainIcon';

const getBaseTokenSymbol = (symbol: string) =>
    symbol.replace(/[._](?:arb|base|bnb|bsc|eth|sol)$/i, '');

type TokenLogoComponentProps = {
    tokenSymbol: string;
    chainId: string | null;
    size?: number;
    badgeSize?: number;
};

const TokenLogoComponent = ({
    tokenSymbol,
    chainId,
    size = 36,
    badgeSize = 18,
}: TokenLogoComponentProps) => {
    const IconComponent =
        TOKEN_LOGO[tokenSymbol] ?? TOKEN_LOGO[getBaseTokenSymbol(tokenSymbol)];
    return (
        <Box
            position="relative"
            display="flex"
            alignItems="center"
            justifyContent="center"
        >
            {IconComponent ? (
                <Box
                    width={`${size}px`}
                    height={`${size}px`}
                    borderRadius="radius-xl"
                    overflow="hidden"
                    alignSelf="center"
                >
                    <IconComponent width={size} height={size} />
                </Box>
            ) : (
                <Box
                    cursor="pointer"
                    display="flex"
                    alignItems="center"
                    padding="spacing-xxs"
                    borderRadius="radius-sm"
                    backgroundColor="pw-int-bg-tertiary-color"
                    width={`${size}px`}
                    height={`${size}px`}
                    justifyContent="center"
                >
                    <Text variant='bl-regular' color='pw-int-text-secondary-color'>{tokenSymbol.charAt(0)}</Text>
                </Box>
            )}
            
            <Box
                position="absolute"
                width={`${badgeSize}px`}
                height={`${badgeSize}px`}
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
                {getChainIcon(chainId, Math.max(10, badgeSize - 2))}
            </Box>
        </Box>
    )
};

export { TokenLogoComponent };

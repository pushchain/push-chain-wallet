import React from 'react';
import { resolveTokenLogoKey, TOKEN_LOGO } from '../Common.constants';
import { Box, PushChainLogo, Text } from 'blocks';
import { css } from 'styled-components';

const TokenLogoComponent = ({ tokenSymbol }: { tokenSymbol: string }) => {

    const logoKey = resolveTokenLogoKey(tokenSymbol);
    const IconComponent = logoKey ? TOKEN_LOGO[logoKey] : undefined;
    if (IconComponent) {
        return (
            <Box
                position="relative"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                <Box
                    width="36px"
                    height="36px"
                    borderRadius="radius-xl"
                    overflow="hidden"
                    alignSelf="center"
                >
                    <IconComponent width={36} height={36} />
                </Box>
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
                    <PushChainLogo height={16} width={16} />
                </Box>
            </Box>
        )
    } else {
        return (
            <Box
                cursor="pointer"
                display="flex"
                alignItems="center"
                padding="spacing-xxs"
                borderRadius="radius-sm"
                backgroundColor="pw-int-bg-tertiary-color"
                width="36px"
                height="36px"
                justifyContent="center"
            >
                <Text variant='bl-regular' color='pw-int-text-secondary-color'>{tokenSymbol.charAt(0)}</Text>
            </Box>
        )
    }
};

export { TokenLogoComponent };
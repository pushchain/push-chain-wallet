import React from 'react';
import { TOKEN_LOGO } from '../Common.constants';
import { Box, Text } from 'blocks';
import { css } from 'styled-components';
import { getChainIcon } from '../../modules/wallet/components/OriginChainTokenListItem';

const TokenLogoComponent = ({ tokenSymbol, chainId }: { tokenSymbol: string, chainId: string | null }) => {

    const IconComponent = TOKEN_LOGO[tokenSymbol];
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
                    <IconComponent width={36} height={36} />;
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
                    {getChainIcon(chainId, 16)}
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
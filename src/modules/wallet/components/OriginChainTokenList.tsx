import { Box, Text } from 'blocks';
import { OriginChainTokenListItem } from './OriginChainTokenListItem';
import { convertCaipToObject } from '../Wallet.utils';
import { css } from 'styled-components';
import { TokenFormat, WalletType } from '../../../types';
import { getOriginChainTokens } from './sendComponent/tokenSearch';

const OriginChainTokenList = ({
    originWalletAddress,
    showFaucet,
    hideHeader,
    handleSelectToken,
    tokens: tokensOverride,
}: {
    originWalletAddress: string
    showFaucet?: boolean
    hideHeader?: boolean
    handleSelectToken?: (token: TokenFormat, walletDetails: WalletType) => void
    tokens?: TokenFormat[]
}) => {

    const { result } = convertCaipToObject(originWalletAddress);

    const tokens = tokensOverride ?? getOriginChainTokens(result);

    if (!tokens.length) return null;

    return (
        <Box
            display='flex'
            flexDirection='column'
            borderRadius="radius-sm"
            border="border-sm solid pw-int-border-secondary-color"
            padding="spacing-xs"
            backgroundColor="pw-int-bg-tertiary-color"
            onClick={() => {
                if (tokens?.[0]) handleSelectToken?.(tokens[0], result);
            }}
            cursor={handleSelectToken && 'pointer'}
        >
            {!hideHeader && <OriginChainWalletHeader />}

            {tokens && tokens.map((token, id) => (
                <OriginChainTokenListItem token={token} walletDetail={result} key={id} showFaucet={showFaucet} />
            ))}

        </Box>
    );
};

export default OriginChainTokenList;

const OriginChainWalletHeader = () => {

    return (
        <Box className='flex' justifyContent="end">
            <Box
                display="flex"
                alignItems="center"
            >
                <Text
                    variant="os-regular"
                    color="pw-int-text-tertiary-color"
                    textTransform='capitalize'
                    css={css`margin-right: 8px;`}
                >
                    External Connected Chain
                </Text>
            </Box>
        </Box>

    )
}

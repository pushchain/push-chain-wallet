import { Box, Text } from 'blocks';
import { useMemo } from 'react';
import { OriginChainTokenListItem } from './OriginChainTokenListItem';
import { convertCaipToObject } from '../Wallet.utils';
import { css } from 'styled-components';
import { TOKEN_LISTS } from '../../../helpers/TokenHelper';

const OriginChainTokenList = ({
    originWalletAddress,
    showFaucet
}: {
    originWalletAddress: string
    showFaucet?: boolean
}) => {

    const { result } = convertCaipToObject(originWalletAddress);

    const tokens = useMemo(() => {
        const chainNs = result.chain?.toLowerCase();
        const chainId = Number(result.chainId);

        if (chainNs === 'solana') return TOKEN_LISTS.SOLANA;

        // EVM chains
        if (chainNs === 'eip155' || chainNs === 'ethereum') {
            switch (chainId) {
                case 11155111: return TOKEN_LISTS.ETHEREUM;
                case 84532:    return TOKEN_LISTS.BASE;
                case 421614:   return TOKEN_LISTS.ARBITRUM;
                case 97:       return TOKEN_LISTS.BINANCE;
                default:       return TOKEN_LISTS.ETHEREUM;
            }
        }
    }, [result.chain, result.chainId]);

    return (
        <Box
            display='flex'
            flexDirection='column'
            borderRadius="radius-sm"
            border="border-sm solid pw-int-border-secondary-color"
            padding="spacing-xs"
            backgroundColor="pw-int-bg-tertiary-color"
        >
            <OriginChainWalletHeader />

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
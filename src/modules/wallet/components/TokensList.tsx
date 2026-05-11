import React, { FC, useMemo } from 'react';
import { TokensListItem } from './TokensListItem';
import { Box, Text, YieldFarming } from 'blocks';
import { ActiveStates, TokenFormat } from '../../../types';
import { useTokenManager } from '../../../hooks/useTokenManager';
import OriginChainTokenList from './OriginChainTokenList';
import { useGlobalState } from '../../../context/GlobalContext';
import { usePushChain } from '../../../context/PushChainContext';
import { convertCaipToObject, getWalletlist } from '../Wallet.utils';
import { css } from 'styled-components';
import { PushChain } from '@pushchain/core';
import { useWalletDashboard } from '../../../context/WalletDashboardContext';
import { useTokenBalance } from '../../../hooks/useTokenBalance';

type TokensListProps = {
    setActiveState: (activeStates: ActiveStates) => void;
}
const TokensList: FC<TokensListProps> = ({
    setActiveState
}) => {

    const { tokens, moveableTokens, prc20Tokens } = useTokenManager();
    const { state } = useGlobalState();
    const { executorAddress } = usePushChain();
    const { startSendFlow } = useWalletDashboard();

    const pushWallet = useMemo(() => getWalletlist(state.wallet)[0], [state.wallet]);
    const readOnlyWallet = state.pushWallet ? PushChain.utils.account.toChainAgnostic(state.pushWallet.address, { chain: state.pushWallet.chain }) : null;
    const parsedWallet = pushWallet?.fullAddress || readOnlyWallet || state?.externalWallet?.originAddress;

    const { result } = useMemo(() => convertCaipToObject(parsedWallet), [parsedWallet]);

    const { data: pcBalance } = useTokenBalance('', executorAddress, 18, null);
    const shouldShowFaucetOnOrigin = !pcBalance || Number(pcBalance) === 0;

    const filteredTokens = useMemo(() => {
        return tokens.filter((t) => {
            const addr = (t?.address ?? '').toLowerCase();
            const existsInMoveable = moveableTokens.some((mt) => (mt?.address ?? '').toLowerCase() === addr);
            const existsInPrc20 = prc20Tokens.some((pt) => (pt?.address ?? '').toLowerCase() === addr);
            return !existsInMoveable && !existsInPrc20;
        });
    }, [tokens, moveableTokens, prc20Tokens]);

    return (

        <Box
            display='flex'
            flexDirection='column'
            gap='spacing-xs'
        >
            <Box
                display='flex'
                flexDirection='column'
                gap='spacing-xxs'
                overflow="hidden scroll"
                height='240px'
                customScrollbar
                css={css`
                    padding-right: 6px;
                    margin-right: -8px;
                `}
            >
                {executorAddress !== result.address && (
                    <OriginChainTokenList
                        originWalletAddress={parsedWallet}
                        showFaucet={shouldShowFaucetOnOrigin}
                    />
                )}
                {filteredTokens.map((token: TokenFormat) => (
                    <TokensListItem
                        token={token}
                        key={token.address}
                        walletDetails={result}
                        handleSelectToken={startSendFlow}
                        showFaucet={!shouldShowFaucetOnOrigin && token.symbol === 'PC'}
                    />
                ))}
                {moveableTokens.filter(t => t.address !== "0x0000000000000000000000000000000000000000")
                .map((token: TokenFormat) => (
                    <TokensListItem token={token} key={token.address} walletDetails={result} isMoveable handleSelectToken={startSendFlow} />
                ))}
                {prc20Tokens.filter(t => t.address !== "0x0000000000000000000000000000000000000000")
                .map((token: TokenFormat) => (
                    <TokensListItem token={token} key={token.address} walletDetails={null} handleSelectToken={startSendFlow} />
                ))}
            </Box>
            <Box
                display='flex'
                justifyContent='center'
                alignItems='center'
                gap='spacing-xxs'
                padding='spacing-xxs'
                cursor='pointer'
                onClick={() => setActiveState('addTokens')}
            >
                <YieldFarming color='pw-int-icon-brand-color' />
                <Text variant='bs-regular' color='pw-int-text-link-color'>Manage Tokens</Text>
            </Box>
        </Box>

    );
};

export { TokensList };
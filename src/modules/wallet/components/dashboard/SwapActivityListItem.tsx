import { FC } from 'react';
import { Back, Box, Swap as SwapIcon, Text } from 'blocks';
import { TokenLogoComponent } from 'common';
import { css } from 'styled-components';
import { SwapActivityRecord } from '../swapComponent/swap.activity';
import { getSwapTokenDisplaySymbol } from '../swapComponent/swap.utils';
import { formatTokenValue } from '../../Wallet.utils';

type SwapActivityListItemProps = {
  activity: SwapActivityRecord;
};

const SwapActivityListItem: FC<SwapActivityListItemProps> = ({
  activity,
}) => {
  const input = activity.tokensIn[0];
  const output = activity.tokensOut[0];
  if (!input || !output) return null;

  const inputSymbol = getSwapTokenDisplaySymbol(input.symbol);
  const outputSymbol = getSwapTokenDisplaySymbol(output.symbol);
  const inputAmount = formatTokenValue(input.amount, 6);
  const outputAmount = formatTokenValue(output.amount, 6);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="spacing-xs"
      padding="spacing-xs spacing-xxxs"
      backgroundColor="pw-int-bg-tertiary-color"
    >
      <Box
        display="flex"
        alignItems="center"
        gap="spacing-xxs"
        css={css`
          min-width: 0;
        `}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          width="32px"
          height="32px"
          borderRadius="radius-xs"
          backgroundColor="pw-int-bg-primary-color"
          css={css`
            flex-shrink: 0;
          `}
        >
          <SwapIcon size={16} color="pw-int-icon-success-bold-color" />
        </Box>

        <Box
          display="flex"
          alignItems="center"
          gap="spacing-xxxs"
          css={css`
            min-width: 0;
          `}
        >
          <TokenLogoComponent
            tokenSymbol={input.symbol}
            chainId={input.chain ?? activity.sourceChain ?? null}
            size={25}
            badgeSize={12}
          />
          <Text variant="bm-semibold">{inputSymbol}</Text>
          <Box
            display="flex"
            css={css`
              flex-shrink: 0;
              transform: rotate(180deg);
            `}
          >
            <Back size={18} color="pw-int-icon-tertiary-color" />
          </Box>
          <TokenLogoComponent
            tokenSymbol={output.symbol}
            chainId={output.chain ?? activity.destinationChain ?? null}
            size={25}
            badgeSize={12}
          />
          <Text variant="bm-semibold">{outputSymbol}</Text>
        </Box>
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        alignItems="flex-end"
        css={css`
          flex-shrink: 0;
          max-width: 42%;
        `}
      >
        <Text
          variant="bs-regular"
          color="pw-int-text-success-bold-color"
          textAlign="right"
          ellipsis
          title={`+${outputAmount} ${outputSymbol}`}
        >
          +{outputAmount} {outputSymbol}
        </Text>
        <Text
          variant="bes-regular"
          color="pw-int-text-tertiary-color"
          textAlign="right"
          ellipsis
          title={`-${inputAmount} ${inputSymbol}`}
        >
          -{inputAmount} {inputSymbol}
        </Text>
      </Box>
    </Box>
  );
};

export { SwapActivityListItem };

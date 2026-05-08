import React, { FC } from "react";
import { css } from "styled-components";
import { Box, Cross, Text } from "../../blocks";
import { MetaMaskIcon, PhantomIcon } from "@dynamic-labs/iconic";
import { Zerion, Rabby } from "../../blocks";

const WALLETS_LOGO = {
  phantom: PhantomIcon,
  metamask: MetaMaskIcon,
  zerion: Zerion,
  rabby: Rabby,
};

const WALLETS_LINKS = {
  phantom: 'https://phantom.app/download',
  metamask: 'https://metamask.io/download/',
  zerion: 'https://zerion.io/download',
  rabby: 'https://rabby.io/',
};

const WALLETS_LABELS = {
  phantom: 'Phantom',
  metamask: 'MetaMask',
  zerion: 'Zerion',
  rabby: 'Rabby',
};

export type NotFoundContentProps = {
  providerName: 'metamask' | 'zerion' | 'rabby' | 'phantom';
	onClose?: () => void;
};

const NotFoundContent: FC<NotFoundContentProps> = ({
  providerName,
	onClose
}) => {
	const Logo = WALLETS_LOGO[providerName];
  const walletLabel = WALLETS_LABELS[providerName];

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      padding="spacing-md"
      gap="spacing-md"
      width="100%"
      borderRadius="radius-md"
      backgroundColor="pw-int-bg-primary-color"
      css={css`
        border-top: var(--border-xmd) solid var(--pw-int-border-secondary-color);
      `}
    >
			<Box
				display="flex"
				flexDirection="column"
				gap="spacing-xs"
				width="100%"
			>
				{onClose && (
					<Box alignSelf="flex-end" cursor="pointer" onClick={() => onClose()}>
						<Cross size={16} color="pw-int-icon-primary-color" />
					</Box>
				)}
				<Box alignSelf="center">
					<Logo width={48} height={48} />
				</Box>
			</Box>
			<Box
				display="flex"
				flexDirection="column"
				alignItems="center"
				gap="spacing-xxxs"
			>
				<Text
					variant='h3-semibold'
					color='pw-int-text-primary-color'
					textAlign='center'
					textTransform="capitalize"
				>
					{walletLabel} Wallet not Found
				</Text>
				<Text
					variant='bs-regular'
					color='pw-int-text-secondary-color'
					textAlign='center'
				>
					To connect to {walletLabel}, install and open the app. Confirm the connection to proceed.
				</Text>
			</Box>
			<Box
				cursor="pointer"
				css={css`
					:hover {
						border: var(--border-sm, 1px) solid var(--pw-int-brand-primary-color);
					}
				`}
				display="flex"
				padding="spacing-xs"
				borderRadius="radius-xs"
				border="border-sm solid pw-int-border-tertiary-color"
				backgroundColor="pw-int-bg-transparent"
				alignItems="center"
				gap="spacing-xxs"
				width="100%"
				onClick={() => window.open(WALLETS_LINKS[providerName], '_blank')}
			>
				<Box
					width="24px"
					height="24px"
					overflow="hidden"
					display="flex"
					alignItems="center"
					justifyContent="center"
					css={css`
						flex-shrink: 0;
					`}
				>
					<Logo height={36} width={36} />
				</Box>
				<Text textTransform="capitalize" variant="bm-semibold" color="pw-int-text-primary-color">
					Install {walletLabel} Wallet
				</Text>
			</Box>
    </Box>
  );
};

export { NotFoundContent };

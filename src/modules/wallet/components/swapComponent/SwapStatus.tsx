import { FC } from 'react';
import {
  ArrowUpRight,
  Box,
  Button,
  Cross,
  Info,
  Spinner,
  Text,
  TickCircleFilled,
} from 'blocks';
import { css } from 'styled-components';

export type SwapStatusType = 'loading' | 'success' | 'error';

type SwapStatusProps = {
  status: SwapStatusType;
  title: string;
  description: string;
  explorerUrl?: string | null;
  onClose: () => void;
};

const SwapStatus: FC<SwapStatusProps> = ({
  status,
  title,
  description,
  explorerUrl,
  onClose,
}) => (
  <Box
    position="absolute"
    width="100%"
    height="100%"
    display="flex"
    alignItems="flex-end"
    borderRadius="radius-md"
    css={css`
      inset: 0;
      z-index: 30;
      background: rgba(0, 0, 0, 0.55);
    `}
  >
    <Box
      display="flex"
      width="100%"
      flexDirection="column"
      alignItems="center"
      gap="spacing-md"
      padding="spacing-lg spacing-md"
      backgroundColor="pw-int-bg-primary-color"
      borderRadius="radius-md radius-md radius-none radius-none"
    >
      {status !== 'loading' && (
        <Box
          display="flex"
          width="100%"
          justifyContent="flex-end"
          cursor="pointer"
          onClick={onClose}
        >
          <Cross size={20} color="pw-int-icon-primary-color" />
        </Box>
      )}
      {status === 'loading' && <Spinner size="extraLarge" variant="primary" />}
      {status === 'success' && (
        <TickCircleFilled size={48} color="pw-int-icon-success-bold-color" />
      )}
      {status === 'error' && (
        <Info size={48} color="pw-int-icon-danger-bold-color" />
      )}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap="spacing-xxs"
      >
        <Text variant="h4-semibold" textAlign="center">
          {title}
        </Text>
        <Text
          variant="bs-regular"
          color="pw-int-text-secondary-color"
          textAlign="center"
        >
          {description}
        </Text>
      </Box>
      {status === 'success' && explorerUrl && (
        <Button
          variant="outline"
          size="small"
          trailingIcon={
            <ArrowUpRight size={18} color="pw-int-icon-primary-color" />
          }
          onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}
        >
          View transaction
        </Button>
      )}
    </Box>
  </Box>
);

export { SwapStatus };

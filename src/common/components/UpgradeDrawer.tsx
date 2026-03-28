import React, { FC, useState } from "react";
import { css } from "styled-components";
import { Box, Button, Text } from "../../blocks";
import { getAppParamValue } from "../Common.utils";
import { WALLET_TO_APP_ACTION, APP_TO_WALLET_ACTION } from "../../common";

export type UpgradeDrawerProps = {
  currentVersion: string;
  newVersion: string;
  onUpgrade: () => Promise<void>;
  onCancel: () => void;
};

const UpgradeDrawer: FC<UpgradeDrawerProps> = ({
  currentVersion,
  newVersion,
  onUpgrade,
  onCancel,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpenedInIframe = !!getAppParamValue();

  const handleUpgrade = async () => {
    if (isOpenedInIframe) {
      setIsLoading(true);
      window.parent?.postMessage(
        {
          type: WALLET_TO_APP_ACTION.UPGRADE_ACCOUNT_REQUEST,
        },
        getAppParamValue()
      );
      return new Promise<boolean>((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === APP_TO_WALLET_ACTION.UPGRADE_ACCOUNT_RESPONSE) {
            window.removeEventListener('message', handleMessage);
            if (event.data.data.success) {
              resolve(true);
              onCancel();
            } else {
              console.error('Upgrade failed:', event.data.data.error);
              setError(`Upgrade failed: ${event.data.data.error}`);
              reject(event.data.data.error);
            }
            setIsLoading(false);
          }
        };
    
        window.addEventListener('message', handleMessage);
    
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
        }, 100000);
      });
    } else {
      setIsLoading(true);
      try {
        await onUpgrade();
      } catch (error) {
        setError(`Upgrade failed: ${error}`);
        console.error('Upgrade failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (isOpenedInIframe) {
      window.parent?.postMessage(
        {
          type: WALLET_TO_APP_ACTION.UPGRADE_ACCOUNT_ERROR,
        },
        getAppParamValue()
      );
    }
    onCancel();
  };

  return (
    <Box
      position="absolute"
      height="100%"
      width="100%"
      alignItems="flex-end"
      display="flex"
      borderRadius="radius-md"
      css={css`
        background: rgba(0, 0, 0, 0.5);
        bottom: 0;
        left: 0;
        z-index: 10;
      `}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        padding="spacing-xs"
        gap="spacing-sm"
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
          textAlign="center"
          gap="spacing-xxxs"
          margin="spacing-md spacing-none"
        >
          <Text variant="h3-semibold" color="pw-int-text-primary-color">
            Account Upgrade Required
          </Text>
          <Box display="flex" flexDirection="column" gap="spacing-xxs" padding="spacing-xxs spacing-none">
            <Text variant="bs-regular" color="pw-int-text-secondary-color">
              Your account requires upgrade from {currentVersion} to {newVersion}. 
              This is a gasless operation and doesn't affect your funds.
            </Text>
            <Text variant="bs-regular" color="pw-int-text-tertiary-color">
              Any write operations (transactions, signatures, or contract interactions) will require this upgrade to proceed.
            </Text>
          </Box>
        </Box>

        <Box
          display="flex"
          flexDirection="column"
          gap="spacing-xs"
          width="100%"
          padding="spacing-xs spacing-none spacing-none spacing-none"
          alignItems="center"
        >
          {error && <Text variant="bs-regular" color="pw-int-error-primary-color">{error}</Text>}
          <Button
            variant="primary"
            block
            onClick={handleUpgrade}
            loading={isLoading}
          >
            Upgrade
          </Button>
          <Button
            variant="outline"
            block
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export { UpgradeDrawer };

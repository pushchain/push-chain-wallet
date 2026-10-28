import { FC, useEffect } from 'react';
import styled from 'styled-components';
import { Spinner } from 'blocks';
import { progressStore, useProgress } from '../../../../../common/progress/progressStore';

/*
 * Busy label for a button whose action runs through the SDK (create, update, delete,
 * rename): a spinner and the SDK's current step ("Awaiting Signature", "Resolving
 * Universal Execution Account"…), the same steps the progress toast shows. Until the
 * first step arrives it shows the fallback. Starting clears the previous action's status
 * so an old "Done" never shows here or in the toast.
 */
export const ProgressLabel: FC<{ fallback: string }> = ({ fallback }) => {
  useEffect(() => {
    progressStore.set(null);
  }, []);
  const progress = useProgress();
  const step = progress?.event.title;

  return (
    <Label title={step ? `${step}…` : fallback}>
      <SpinnerSlot>
        <Spinner size="small" variant="primary" />
      </SpinnerSlot>
      <Text>{step ? `${step}…` : fallback}</Text>
    </Label>
  );
};

/* Fits the button: a long step ("Resolving Universal Execution Account…") ends in an ellipsis,
   including in the half-width sheet buttons. */
const Label = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxs);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
`;

const SpinnerSlot = styled.span`
  display: flex;
  flex-shrink: 0;
`;

const Text = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

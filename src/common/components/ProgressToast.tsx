import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { PROGRESS_HOOK } from "@pushchain/core/src/lib/progress-hook/progress-hook.types";
import type { ProgressEvent } from "@pushchain/core/src/lib/progress-hook/progress-hook.types";
import { ArrowUpRight, CaretDown, CaretUp, Cross, Spinner, TickCircleFilled, WarningCircleFilled } from "../../blocks";
import { EXPLORER_URL } from "../Common.constants";
import { progressStore, useProgress } from "../progress/progressStore";

/*
 * Bottom-right progress toast, after the UI kit's PushWalletToast: the SDK's progress
 * events (sends, swaps, agentic wallet changes) with a spinner, a tick on success or a
 * warning on failure, and a link to follow the transaction. Uses the wallet's theme
 * colours so it reads in light and dark mode.
 */

const SUCCESS_IDS: ReadonlyArray<string> = [
  PROGRESS_HOOK.SEND_TX_199_01,
  PROGRESS_HOOK.SEND_TX_299_01,
  PROGRESS_HOOK.SEND_TX_399_01,
  PROGRESS_HOOK.SEND_TX_999_01,
  PROGRESS_HOOK.UEA_MIG_9901,
  PROGRESS_HOOK.AGENTIC_TX_199_01,
];

const FAILURE_IDS: ReadonlyArray<string> = [
  PROGRESS_HOOK.SEND_TX_199_02,
  PROGRESS_HOOK.SEND_TX_299_02,
  PROGRESS_HOOK.SEND_TX_299_03,
  PROGRESS_HOOK.SEND_TX_399_02,
  PROGRESS_HOOK.SEND_TX_399_03,
  PROGRESS_HOOK.SEND_TX_999_02,
  PROGRESS_HOOK.SEND_TX_999_03,
  PROGRESS_HOOK.AGENTIC_TX_199_02,
];

/* Read-only lookups (deriving a wallet, resolving a rule) would pop a toast on every list load. */
const IGNORED_IDS: ReadonlyArray<string> = [PROGRESS_HOOK.AGENTIC_TX_101, PROGRESS_HOOK.AGENTIC_TX_107];

const TRANSACTION_START_IDS: ReadonlyArray<string> = [
  PROGRESS_HOOK.SEND_TX_001,
  PROGRESS_HOOK.SEND_TX_101,
  PROGRESS_HOOK.SEND_TX_201,
  PROGRESS_HOOK.SEND_TX_301,
];

type ProgressResponse = { txHash?: unknown; pushTxHash?: unknown; chain?: unknown };

/* The `utx` value the Donut lifecycle tracker expects: `${chain}:${hash}` (as in the UI kit). */
const getUniversalTxId = (event: ProgressEvent, originChain?: string) => {
  const response = event.response as ProgressResponse | null;
  if (!response) return null;
  const hash =
    typeof response.pushTxHash === "string"
      ? response.pushTxHash
      : typeof response.txHash === "string"
        ? response.txHash
        : null;
  if (!hash) return null;
  const chain = originChain || (typeof response.chain === "string" ? response.chain : null);
  return chain ? `${chain}:${hash}` : null;
};

const ProgressToast: FC = () => {
  const progress = useProgress();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const trackedTx = useRef<string | null>(null);

  const event = progress && !IGNORED_IDS.includes(progress.event.id) ? progress.event : null;

  useEffect(() => {
    setExpanded(false);
  }, [event?.id]);

  // A finished operation clears itself, so its "Done" doesn't sit on screen into the next one.
  // Failures stay until dismissed.
  useEffect(() => {
    if (!event || !(SUCCESS_IDS.includes(event.id) || event.level === "SUCCESS")) return;
    const timer = setTimeout(() => {
      if (progressStore.get()?.event === event) progressStore.set(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [event]);

  useLayoutEffect(() => {
    const el = textRef.current;
    setOverflowing(!!el && el.scrollWidth > el.clientWidth);
  }, [event?.message]);

  if (!event) return null;

  const isSuccess = SUCCESS_IDS.includes(event.id) || event.level === "SUCCESS";
  const isFailure = FAILURE_IDS.includes(event.id) || event.level === "ERROR";
  if (TRANSACTION_START_IDS.includes(event.id)) trackedTx.current = null;
  trackedTx.current ??= getUniversalTxId(event, progress?.originChain);
  const txHash = (event.response as { txHash?: string } | null)?.txHash;
  const message = event.message ?? "";

  return (
    <Toast role="status" aria-live="polite">
      <IconSlot>
        {isSuccess ? (
          <TickCircleFilled size={18} color="pw-int-icon-success-bold-color" />
        ) : isFailure ? (
          <WarningCircleFilled size={18} color="pw-int-icon-danger-bold-color" />
        ) : (
          <Spinner size="small" variant="primary" />
        )}
      </IconSlot>

      <Content>
        <Title>{event.title}</Title>

        {isSuccess && txHash && (
          <Link href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
            View in Explorer
            <ArrowUpRight size={14} />
          </Link>
        )}

        {!isSuccess && !isFailure && trackedTx.current && (
          <Link
            href={`${EXPLORER_URL}/track?utx=${trackedTx.current}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Track Live Progress
            <ArrowUpRight size={14} />
          </Link>
        )}

        {isFailure && message && (
          <Description>
            <DescriptionText ref={textRef} $expanded={expanded}>
              {message}
            </DescriptionText>
            {(overflowing || expanded) && (
              <ExpandButton type="button" onClick={() => setExpanded(!expanded)}>
                {expanded ? "View Less" : "View More"}
                {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </ExpandButton>
            )}
          </Description>
        )}
      </Content>

      <CloseButton type="button" aria-label="Dismiss" onClick={() => progressStore.set(null)}>
        <Cross size={18} color="pw-int-icon-primary-color" />
      </CloseButton>
    </Toast>
  );
};

export { ProgressToast };

/* Same placement and size as the UI kit toast */
const Toast = styled.div`
  position: fixed;
  bottom: 40px;
  right: 30px;
  z-index: 999999990;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: var(--spacing-sm);
  border: 1px solid var(--pw-int-border-secondary-color);
  border-radius: var(--radius-sm);
  background: var(--pw-int-bg-secondary-color);
  box-sizing: border-box;
  font-family: var(--pw-int-font-family);
`;

const IconSlot = styled.div`
  display: flex;
  align-items: center;
  height: 21px;
  flex-shrink: 0;
`;

const Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
`;

const Title = styled.span`
  font-size: 14px;
  line-height: 21px;
  font-weight: 500;
  color: var(--pw-int-text-primary-color);
`;

const Link = styled.a`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxxs);
  font-size: 14px;
  line-height: 18px;
  color: var(--pw-int-text-link-color);
  text-decoration: none;
`;

const Description = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

const DescriptionText = styled.span<{ $expanded: boolean }>`
  width: 100%;
  font-size: 14px;
  line-height: 18px;
  color: var(--pw-int-text-secondary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  white-space: ${({ $expanded }) => ($expanded ? "pre-wrap" : "nowrap")};
`;

const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  color: var(--pw-int-text-tertiary-color);
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  height: 21px;
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
`;

import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SwapActivityRecord } from '../modules/wallet/components/swapComponent/swap.activity';
import {
  loadPersistedSwapExecutions,
  persistSuccessfulSwapExecutions,
} from '../modules/wallet/components/swapComponent/swap.persistence';
import { SwapTransactionRef } from '../modules/wallet/components/swapComponent/swap.types';

export type SwapExecutionRecord = SwapActivityRecord & {
  executionId: string;
  executorAddress: string;
  transactionRefs: SwapTransactionRef[];
};

type SwapRecordUpdate =
  | Partial<SwapExecutionRecord>
  | ((record: SwapExecutionRecord) => SwapExecutionRecord);

type SwapTransactionContextValue = {
  swapExecutions: SwapExecutionRecord[];
  activeSwapExecution: SwapExecutionRecord | null;
  isSwapDrawerOpen: boolean;
  selectedSwapActivity: SwapActivityRecord | null;
  beginSwapExecution: (record: SwapExecutionRecord) => void;
  updateSwapExecution: (executionId: string, update: SwapRecordUpdate) => void;
  dismissSwapDrawer: () => void;
  selectSwapActivity: (activity: SwapActivityRecord | null) => void;
};

const SwapTransactionContext =
  createContext<SwapTransactionContextValue | null>(null);

const SwapTransactionProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [swapExecutions, setSwapExecutions] = useState<
    SwapExecutionRecord[]
  >(() => loadPersistedSwapExecutions());
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(
    null,
  );
  const [isSwapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const dismissedPendingExecutionId = useRef<string | null>(null);
  const [selectedSwapActivity, selectSwapActivity] =
    useState<SwapActivityRecord | null>(null);

  useEffect(() => {
    persistSuccessfulSwapExecutions(swapExecutions);
  }, [swapExecutions]);

  const beginSwapExecution = useCallback((record: SwapExecutionRecord) => {
    setSwapExecutions((current) => [
      record,
      ...current.filter(
        (candidate) => candidate.executionId !== record.executionId,
      ),
    ]);
    setActiveExecutionId(record.executionId);
    dismissedPendingExecutionId.current = null;
    setSwapDrawerOpen(true);
  }, []);

  const updateSwapExecution = useCallback(
    (executionId: string, update: SwapRecordUpdate) => {
      setSwapExecutions((current) =>
        current.map((record) => {
          if (record.executionId !== executionId) return record;
          return typeof update === 'function'
            ? update(record)
            : { ...record, ...update };
        }),
      );
    },
    [],
  );

  const activeSwapExecution = useMemo(
    () =>
      swapExecutions.find(
        (record) => record.executionId === activeExecutionId,
      ) ?? null,
    [activeExecutionId, swapExecutions],
  );

  const dismissSwapDrawer = useCallback(() => {
    dismissedPendingExecutionId.current =
      activeSwapExecution?.status === 'pending'
        ? activeSwapExecution.executionId
        : null;
    setSwapDrawerOpen(false);
  }, [activeSwapExecution]);

  useEffect(() => {
    if (
      activeSwapExecution &&
      activeSwapExecution.status !== 'pending' &&
      dismissedPendingExecutionId.current ===
        activeSwapExecution.executionId
    ) {
      dismissedPendingExecutionId.current = null;
      setSwapDrawerOpen(true);
    }
  }, [activeSwapExecution]);

  const value = useMemo<SwapTransactionContextValue>(
    () => ({
      swapExecutions,
      activeSwapExecution,
      isSwapDrawerOpen,
      selectedSwapActivity,
      beginSwapExecution,
      updateSwapExecution,
      dismissSwapDrawer,
      selectSwapActivity,
    }),
    [
      activeSwapExecution,
      beginSwapExecution,
      dismissSwapDrawer,
      isSwapDrawerOpen,
      selectedSwapActivity,
      swapExecutions,
      updateSwapExecution,
    ],
  );

  return (
    <SwapTransactionContext.Provider value={value}>
      {children}
    </SwapTransactionContext.Provider>
  );
};

const useSwapTransaction = () => {
  const context = useContext(SwapTransactionContext);
  if (!context) {
    throw new Error(
      'useSwapTransaction must be used within a SwapTransactionProvider',
    );
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { SwapTransactionProvider, useSwapTransaction };

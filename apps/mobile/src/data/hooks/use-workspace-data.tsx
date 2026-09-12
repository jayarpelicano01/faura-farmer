import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type {
  MobileAccount,
  MobileBudget,
  MobileCategory,
  MobileDebt,
  MobileDebtAdjustment,
  MobileDebtCashEvent,
  MobileDebtPayment,
  MobileMonthlyBudget,
  MobilePerson,
  MobileRecurringRule,
  MobileTransaction,
} from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import type { DatabaseHandle } from '@/data/db';
import { useSync } from '@/sync/use-sync';

type WorkspaceData = {
  accounts: MobileAccount[];
  budgets: MobileBudget[];
  categories: MobileCategory[];
  debts: MobileDebt[];
  debtAdjustments: MobileDebtAdjustment[];
  debtCashEvents: MobileDebtCashEvent[];
  debtPayments: MobileDebtPayment[];
  error: string | null;
  lastSyncedAt: string | null;
  loading: boolean;
  monthlyBudgets: MobileMonthlyBudget[];
  people: MobilePerson[];
  recurringRules: MobileRecurringRule[];
  reload: () => Promise<void>;
  transactions: MobileTransaction[];
};

type WorkspaceSnapshot = Omit<WorkspaceData, 'reload'>;

const emptySnapshot: WorkspaceSnapshot = {
  accounts: [],
  budgets: [],
  categories: [],
  debts: [],
  debtAdjustments: [],
  debtCashEvents: [],
  debtPayments: [],
  error: null,
  lastSyncedAt: null,
  loading: true,
  monthlyBudgets: [],
  people: [],
  recurringRules: [],
  transactions: [],
};

const WorkspaceDataContext = createContext<WorkspaceData | null>(null);

export function WorkspaceDataProvider({ children }: PropsWithChildren) {
  const { activeWorkspace, db } = useWorkspace();
  const { syncStatus } = useSync();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(emptySnapshot);
  const requestVersion = useRef(0);
  const inFlight = useRef<{ db: DatabaseHandle; promise: Promise<void> } | null>(null);

  const reload = useCallback(() => {
    if (inFlight.current?.db === db) return inFlight.current.promise;

    const version = ++requestVersion.current;
    setSnapshot((current) => ({ ...current, loading: true, error: null }));
    let promise: Promise<void>;
    promise = Promise.all([
      db.listRecords('account'),
      db.listRecords('budget'),
      db.listRecords('category'),
      db.listRecords('debt'),
      db.listRecords('debt_adjustment'),
      db.listRecords('debt_cash_event'),
      db.listRecords('debt_payment'),
      db.getLastSyncedAt(),
      db.listRecords('monthly_budget'),
      db.listRecords('person'),
      db.listRecords('recurring_rule'),
      db.listRecords('transaction'),
    ]).then(([accounts, budgets, categories, debts, debtAdjustments, debtCashEvents, debtPayments, lastSyncedAt, monthlyBudgets, people, recurringRules, transactions]) => {
      if (version !== requestVersion.current) return;
      setSnapshot({
        accounts,
        budgets,
        categories,
        debts,
        debtAdjustments,
        debtCashEvents,
        debtPayments,
        error: null,
        lastSyncedAt,
        loading: false,
        monthlyBudgets,
        people,
        recurringRules,
        transactions,
      });
    }).catch(() => {
      if (version !== requestVersion.current) return;
      setSnapshot((current) => ({
        ...current,
        error: 'Unable to load data saved on this device.',
        loading: false,
      }));
    }).finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });

    inFlight.current = { db, promise };
    return promise;
  }, [db]);

  useEffect(() => { void reload(); }, [activeWorkspace, reload]);
  useEffect(() => {
    if (syncStatus === 'success' || syncStatus === 'attention') void reload();
  }, [reload, syncStatus]);

  const value = useMemo<WorkspaceData>(() => ({ ...snapshot, reload }), [reload, snapshot]);
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData() {
  const context = useContext(WorkspaceDataContext);
  if (!context) throw new Error('useWorkspaceData must be used inside WorkspaceDataProvider');
  return context;
}

import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { calculateDebtState, summarizeDebtBalances, type MobileAccount, type MobileTransaction } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import { localMonthKey, transactionDateKey } from '@/data/date';
import { Button, Card, Empty, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { useCurrency } from '@/ui/currency';

function accountLabel(accounts: MobileAccount[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.label ?? 'Unknown account';
}

export default function DashboardScreen() {
  const { theme } = useAppTheme();
  const styles = useDashboardStyles();
  const ui = useUiStyles();
  const { activeWorkspace } = useWorkspace();
  const { accounts, debtAdjustments, debtCashEvents, debtPayments, debts, reload, transactions } = useWorkspaceData();
  const { lastSyncFailed, syncNow } = useSync();
  const { convert, displayCurrency, formatMoney, rateDate, rateRefreshedAt, usdPerPhp } = useCurrency();
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const balances = new Map(accounts.map((account) => [account.id, Number(account.startingBalance)]));
  const currentMonth = localMonthKey();
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'income') {
      if (transactionDateKey(transaction.date)?.slice(0, 7) === currentMonth) {
        income += Number(convert(amount, accounts.find((account) => account.id === transaction.accountId)?.currency ?? 'PHP'));
      }
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) + amount);
    }
    if (transaction.type === 'expense') {
      if (transactionDateKey(transaction.date)?.slice(0, 7) === currentMonth) {
        expense += Number(convert(amount, accounts.find((account) => account.id === transaction.accountId)?.currency ?? 'PHP'));
      }
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
    }
    if (transaction.type === 'transfer') {
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
      if (transaction.destinationAccountId) balances.set(transaction.destinationAccountId, (balances.get(transaction.destinationAccountId) ?? 0) + amount);
    }
  }
  for (const event of debtCashEvents) {
    const amount = Number(event.amount);
    balances.set(event.accountId, (balances.get(event.accountId) ?? 0) + (event.direction === 'in' ? amount : -amount));
  }
  const total = Math.round(accounts.reduce((sum, account) => sum + Number(convert(balances.get(account.id) ?? 0, account.currency)), 0) * 100) / 100;
  const safeIncome = Math.round(income * 100) / 100;
  const safeExpense = Math.round(expense * 100) / 100;
  const debtSummary = summarizeDebtBalances(debts.map((debt) => ({
    direction: debt.direction,
    currency: debt.currency,
    outstandingBalance: calculateDebtState({
      originalPrincipal: debt.originalPrincipal,
      adjustments: debtAdjustments.filter((item) => item.debtId === debt.id).map((item) => ({ amount: item.amount })),
      payments: debtPayments.filter((item) => item.debtId === debt.id).map((item) => ({ amount: item.amount })),
      status: debt.status,
    }).outstandingBalance,
  })), { displayCurrency, usdPerPhp, rateDate, rateRefreshedAt });

  return (
    <Screen scrollable>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Dashboard</Title>
          <Text style={styles.subtitle}>Here’s your money at a glance.</Text>
        </View>
        {activeWorkspace === 'online' ? (
        <View style={styles.syncControl}>
          <Button
            accessibilityLabel="Sync your data"
            onPress={() => void syncNow(true)}
            size="compact"
            variant="outline"
          >Sync</Button>
          {lastSyncFailed ? <View pointerEvents="none" style={styles.syncRetryDot} /> : null}
        </View>
        ) : null}
      </View>

      <Link href={'/debts' as Href} asChild>
        <Pressable accessibilityLabel="Open debts" accessibilityRole="link">
          {({ pressed }) => <View style={pressed ? styles.sectionHeaderPressed : undefined}>
            <Card>
              <Text style={styles.metricLabel}>Debt position</Text>
              {debts.length === 0 ? <Text style={styles.debtEmpty}>No debts yet. Track what people owe you and what you owe them.</Text> : <View style={styles.debtTotals}><View><Text style={styles.debtLabel}>Owed to you</Text><Text style={[styles.debtValue, styles.income]}>{formatMoney(debtSummary.owedToYou)}</Text></View><View><Text style={styles.debtLabel}>You owe</Text><Text style={[styles.debtValue, styles.expense]}>{formatMoney(debtSummary.youOwe)}</Text></View><View><Text style={styles.debtLabel}>Net position</Text><Text style={styles.debtValue}>{formatMoney(debtSummary.netPosition)}</Text></View></View>}
            </Card>
          </View>}
        </Pressable>
      </Link>

      <View style={styles.metrics}>
        <Card>
          <Text style={styles.metricLabel}>Total balance</Text>
          <Text style={styles.metricValue}>{formatMoney(total)}</Text>
        </Card>
        <View style={styles.metricPair}>
          <View style={styles.metricHalf}>
            <Card>
              <Text style={styles.metricLabel}>Income this month</Text>
              <Text style={[styles.metricValue, styles.income]}>{formatMoney(safeIncome)}</Text>
            </Card>
          </View>
          <View style={styles.metricHalf}>
            <Card>
              <Text style={styles.metricLabel}>Expense this month</Text>
              <Text style={[styles.metricValue, styles.expense]}>{formatMoney(safeExpense)}</Text>
            </Card>
          </View>
        </View>
      </View>

      <Link href="/transactions" asChild>
        <Pressable accessibilityHint="Open all transactions" accessibilityLabel="Recent transactions" accessibilityRole="link">
          {({ pressed }) => (
            <View style={[styles.sectionHeader, pressed ? styles.sectionHeaderPressed : undefined]}>
              <SectionTitle>Recent transactions</SectionTitle>
              <Text style={styles.sectionLink}>View all</Text>
            </View>
          )}
        </Pressable>
      </Link>
      {transactions.length === 0 ? <Empty>Your recent transactions will appear here.</Empty> : (
        <Card>
          <View style={styles.rowGroup}>
            {transactions.slice(0, 5).map((item, index) => {
              const account = accounts.find((entry) => entry.id === item.accountId);
              const label = item.type === 'transfer' && item.destinationAccountId
                ? `${accountLabel(accounts, item.accountId)} → ${accountLabel(accounts, item.destinationAccountId)}`
                : accountLabel(accounts, item.accountId);
              return (
                <View key={item.id} style={[styles.transactionRow, index > 0 ? styles.rowDivider : undefined]}>
                  <View style={[styles.identityMark, { backgroundColor: account?.color ?? theme.primary }]}>
                    <Text style={styles.identityText}>{label.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.transactionCopy}>
                    <Text numberOfLines={1} style={ui.listTitle}>{item.note?.trim() || label}</Text>
                    <Text numberOfLines={1} style={ui.listMeta}>{item.date} · {item.type}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, item.type === 'income' ? styles.income : item.type === 'expense' ? styles.expense : undefined]}>
                    {item.type === 'income' ? '+' : item.type === 'expense' ? '−' : ''}{formatMoney(item.amount, account?.currency ?? 'PHP')}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      <Link href="/accounts" asChild>
        <Pressable accessibilityHint="Open all accounts" accessibilityLabel="Accounts" accessibilityRole="link">
          {({ pressed }) => (
            <View style={[styles.sectionHeader, pressed ? styles.sectionHeaderPressed : undefined]}>
              <SectionTitle>Accounts</SectionTitle>
              <Text style={styles.sectionLink}>{accounts.length} total · View all</Text>
            </View>
          )}
        </Pressable>
      </Link>
      {accounts.length === 0 ? <Empty>Create an account to start tracking.</Empty> : (
        <Card>
          <View style={styles.rowGroup}>
            {accounts.map((account, index) => (
              <View key={account.id} style={[styles.accountRow, index > 0 ? styles.rowDivider : undefined]}>
                <View style={[styles.identityMark, { backgroundColor: account.color ?? theme.primary }]}>
                  <Text style={styles.identityText}>{account.label.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.transactionCopy}>
                  <Text numberOfLines={1} style={ui.listTitle}>{account.label}</Text>
                  <Text style={ui.listMeta}>{account.type.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.accountAmount}>{formatMoney(balances.get(account.id) ?? 0, account.currency)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

function useDashboardStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
   headingCopy: { flex: 1, minWidth: 0 },
   syncControl: { position: 'relative', alignSelf: 'flex-start' },
   syncRetryDot: { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.danger },
   subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  metrics: { gap: 0, marginBottom: 10 },
  metricPair: { flexDirection: 'row', gap: 12 },
  metricHalf: { flex: 1, minWidth: 0 },
  metricLabel: { color: theme.mutedForeground, fontFamily: fontFamily.display, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  metricValue: { marginTop: 9, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 18, fontWeight: '600', letterSpacing: -0.8, lineHeight: 28 },
  debtEmpty: { marginTop: 10, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  debtTotals: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  debtLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 11, lineHeight: 16 },
  debtValue: { marginTop: 3, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  income: { color: theme.income },
  expense: { color: theme.expense },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionHeaderPressed: { opacity: 0.72 },
  sectionLink: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  rowGroup: { gap: 0 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 10 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 9 },
  rowDivider: { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
  identityMark: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 18 },
  identityText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700' },
  transactionCopy: { flex: 1, minWidth: 0, gap: 2 },
  transactionAmount: { flexShrink: 0, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  accountAmount: { flexShrink: 0, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  }), [theme]);
}

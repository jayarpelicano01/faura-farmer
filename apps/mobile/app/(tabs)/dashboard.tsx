import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { MobileAccount, MobileTransaction } from '@faura-farmer/types';
import { listRecords } from '@/data/db';
import { localMonthKey, transactionDateKey } from '@/data/date';
import { Button, Card, Empty, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { useCurrency } from '@/ui/currency';

const phpCurrency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' });
const currency = (amount: number) => phpCurrency.format(amount);

function accountLabel(accounts: MobileAccount[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.label ?? 'Unknown account';
}

export default function DashboardScreen() {
  const { theme } = useAppTheme();
  const styles = useDashboardStyles();
  const ui = useUiStyles();
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const loadVersion = useRef(0);
  const { lastSyncFailed, syncStatus, syncNow } = useSync();
  const { convert, formatMoney } = useCurrency();
  const load = useCallback(async () => {
    const requestVersion = ++loadVersion.current;
    const [nextAccounts, nextTransactions] = await Promise.all([
      listRecords('account'),
      listRecords('transaction'),
    ]);
    if (requestVersion !== loadVersion.current) return;
    setAccounts(nextAccounts);
    setTransactions(nextTransactions);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (syncStatus === 'success') void load();
  }, [load, syncStatus]);

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
  const total = Math.round(accounts.reduce((sum, account) => sum + Number(convert(balances.get(account.id) ?? 0, account.currency)), 0) * 100) / 100;
  const safeIncome = Math.round(income * 100) / 100;
  const safeExpense = Math.round(expense * 100) / 100;

  return (
    <Screen scrollable>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Dashboard</Title>
          <Text style={styles.subtitle}>Here’s your money at a glance.</Text>
        </View>
        <View style={styles.syncControl}>
          <Button
            accessibilityLabel="Sync your data"
            onPress={() => void syncNow(true)}
            size="compact"
            variant="outline"
          >Sync</Button>
          {lastSyncFailed ? <View pointerEvents="none" style={styles.syncRetryDot} /> : null}
        </View>
      </View>

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

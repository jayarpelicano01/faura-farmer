import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileAccount, MobileTransaction } from '@faura-farmer/types';
import { listRecords } from '@/data/db';
import { Card, Empty, Screen, SectionTitle, Title, ui } from '@/ui/primitives';
import { fontFamily, theme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';

const phpCurrency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' });
const currency = (amount: number) => phpCurrency.format(amount);

function accountLabel(accounts: MobileAccount[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.label ?? 'Unknown account';
}

export default function DashboardScreen() {
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const { syncing, syncNow } = useSync();
  const load = useCallback(async () => {
    setAccounts(await listRecords('account'));
    setTransactions(await listRecords('transaction'));
  }, []);

  useEffect(() => { void load(); }, [load, syncing]);

  const balances = new Map(accounts.map((account) => [account.id, Number(account.startingBalance)]));
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'income') {
      income += amount;
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) + amount);
    }
    if (transaction.type === 'expense') {
      expense += amount;
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
    }
    if (transaction.type === 'transfer') {
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
      if (transaction.destinationAccountId) balances.set(transaction.destinationAccountId, (balances.get(transaction.destinationAccountId) ?? 0) + amount);
    }
  }
  const total = [...balances.values()].reduce((sum, value) => sum + value, 0);

  return (
    <Screen scrollable>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Dashboard</Title>
          <Text style={styles.subtitle}>Here’s your money at a glance.</Text>
        </View>
        <Pressable
          accessibilityLabel={syncing ? 'Syncing your data' : 'Sync your data'}
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => void syncNow(true)}
          style={({ pressed }) => [styles.syncButton, pressed && !syncing ? styles.pressed : undefined, syncing ? styles.syncButtonDisabled : undefined]}
        >
          <Text style={styles.syncButtonText}>{syncing ? 'Syncing…' : 'Sync'}</Text>
        </Pressable>
      </View>

      <View style={styles.metrics}>
        <Card>
          <Text style={styles.metricLabel}>Total balance</Text>
          <Text style={styles.metricValue}>{currency(total)}</Text>
        </Card>
        <View style={styles.metricPair}>
          <View style={styles.metricHalf}>
            <Card>
              <Text style={styles.metricLabel}>Income this month</Text>
              <Text style={[styles.metricValue, styles.income]}>{currency(income)}</Text>
            </Card>
          </View>
          <View style={styles.metricHalf}>
            <Card>
              <Text style={styles.metricLabel}>Expense this month</Text>
              <Text style={[styles.metricValue, styles.expense]}>{currency(expense)}</Text>
            </Card>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <SectionTitle>Recent transactions</SectionTitle>
        <Text style={styles.sectionLink}>Latest five</Text>
      </View>
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
                    {item.type === 'income' ? '+' : item.type === 'expense' ? '−' : ''}{currency(Number(item.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      <View style={styles.sectionHeader}>
        <SectionTitle>Accounts</SectionTitle>
        <Text style={styles.sectionLink}>{accounts.length} total</Text>
      </View>
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
                <Text style={styles.accountAmount}>{currency(balances.get(account.id) ?? 0)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
  headingCopy: { flex: 1, minWidth: 0 },
  subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  syncButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderColor: theme.border, borderRadius: 8, borderWidth: 1, backgroundColor: theme.surface, paddingHorizontal: 13 },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  metrics: { gap: 0, marginBottom: 10 },
  metricPair: { flexDirection: 'row', gap: 12 },
  metricHalf: { flex: 1, minWidth: 0 },
  metricLabel: { color: theme.mutedForeground, fontFamily: fontFamily.display, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  metricValue: { marginTop: 9, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 20, fontWeight: '600', letterSpacing: -0.8, lineHeight: 28 },
  income: { color: theme.income },
  expense: { color: theme.expense },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
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
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});

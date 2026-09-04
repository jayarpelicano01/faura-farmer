import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAccount, MobileCategory, MobileTransaction } from '@faura-farmer/types';
import { listRecords, queueDelete, queueUpsert } from '@/data/db';
import { Button, Card, ChoiceChip, Empty, Field, Screen, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { useRouter } from 'expo-router';

function blankTransaction(accountId: string): MobileTransaction {
  return { id: Crypto.randomUUID(), accountId, categoryId: null, bucket: null, amount: '', type: 'expense', destinationAccountId: null, date: new Date().toISOString().slice(0, 10), note: null, updatedAt: new Date().toISOString() };
}

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function accountName(accounts: MobileAccount[], id: string | null) {
  return accounts.find((account) => account.id === id)?.label ?? 'Unknown account';
}

function categoryName(categories: MobileCategory[], id: string | null) {
  return categories.find((category) => category.id === id)?.name;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useTransactionsStyles();
  const ui = useUiStyles();
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [editing, setEditing] = useState<MobileTransaction | null>(null);
  const { syncNow } = useSync();
  const load = useCallback(async () => {
    setTransactions(await listRecords('transaction'));
    setAccounts(await listRecords('account'));
    setCategories(await listRecords('category'));
  }, []);
  useEffect(() => { void load(); }, [load, editing]);

  const begin = () => accounts.length ? setEditing(blankTransaction(accounts[0].id)) : Alert.alert('Add an account first', 'Transactions need an account.');
  const save = async () => {
    if (!editing || !/^\d+(\.\d{1,2})?$/.test(editing.amount) || !editing.accountId) {
      Alert.alert('Check this transaction', 'An account and valid amount are required.');
      return;
    }
    if (editing.type === 'transfer' && (!editing.destinationAccountId || editing.destinationAccountId === editing.accountId)) {
      Alert.alert('Choose another account', 'Transfers need a different destination account.');
      return;
    }
    const record = { ...editing, categoryId: editing.type === 'transfer' ? null : editing.categoryId, bucket: editing.type === 'transfer' ? null : editing.bucket, destinationAccountId: editing.type === 'transfer' ? editing.destinationAccountId : null, updatedAt: new Date().toISOString() };
    await queueUpsert('transaction', record);
    setEditing(null);
    await load();
    void syncNow();
  };
  const remove = (id: string) => Alert.alert('Delete transaction?', 'This will synchronize as a deletion when online.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void queueDelete('transaction', id).then(load).then(() => syncNow()); } },
  ]);

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Transactions</Title>
          <Text style={styles.subtitle}>Income, spending, and account transfers.</Text>
        </View>
        <Button
          accessibilityLabel="Create a new transaction"
          onPress={begin}
          size="compact"
        >New</Button>
      </View>
      <ScrollView contentContainerStyle={styles.listContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? <Empty>Income, expenses, and transfers work offline.</Empty> : (
          <Card>
            <View style={styles.rowGroup}>
              {transactions.map((item, index) => {
                const source = accounts.find((account) => account.id === item.accountId);
                const label = item.type === 'transfer' && item.destinationAccountId
                  ? `${accountName(accounts, item.accountId)} → ${accountName(accounts, item.destinationAccountId)}`
                  : accountName(accounts, item.accountId);
                const detail = item.type === 'transfer'
                  ? 'Transfer'
                  : categoryName(categories, item.categoryId) ?? item.type;
                const currency = source?.currency ?? 'PHP';
                return (
                  <Pressable
                    key={item.id}
                    accessibilityHint="Double tap to edit. Press and hold to delete."
                    accessibilityLabel={`${label}, ${item.type}, ${formatMoney(item.amount, currency)}`}
                    accessibilityRole="button"
                    onLongPress={() => remove(item.id)}
                    onPress={() => setEditing(item)}
                  >
                    {({ pressed }) => (
                      <View style={[styles.transactionRow, index > 0 ? styles.rowDivider : undefined, pressed ? styles.rowPressed : undefined]}>
                        <View style={[styles.identityMark, { backgroundColor: source?.color ?? theme.primary }]}>
                          <Text style={styles.identityText}>{label.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.transactionCopy}>
                          <Text numberOfLines={1} style={ui.listTitle}>{item.note?.trim() || label}</Text>
                          <Text numberOfLines={1} style={ui.listMeta}>{item.date} · {detail}</Text>
                        </View>
                        <Text style={[styles.amount, item.type === 'income' ? styles.income : item.type === 'expense' ? styles.expense : undefined]}>
                          {item.type === 'income' ? '+' : item.type === 'expense' ? '−' : ''}{formatMoney(item.amount, currency)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}
      </ScrollView>

      <Button variant="outline" onPress={() => router.replace('/(tabs)/dashboard')}>Done</Button>

      <TransactionEditor accounts={accounts} categories={categories} exists={transactions.some((item) => item.id === editing?.id)} transaction={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={() => void save()} />
    </Screen>
  );
}

function TransactionEditor({ accounts, categories, exists, transaction, onChange, onCancel, onSave }: { accounts: MobileAccount[]; categories: MobileCategory[]; exists: boolean; transaction: MobileTransaction | null; onChange: (transaction: MobileTransaction) => void; onCancel: () => void; onSave: () => void }) {
  const styles = useTransactionsStyles();
  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="formSheet" visible={Boolean(transaction)}>
      <Screen scrollable>
        <View style={styles.editorHeader}>
          <Title>{exists ? 'Edit transaction' : 'New transaction'}</Title>
          <Text style={styles.subtitle}>Record money moving in, out, or between accounts.</Text>
        </View>
        {transaction ? <View style={styles.form}>
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chips}>{(['income', 'expense', 'transfer'] as const).map((type) => <ChoiceChip key={type} label={type} selected={transaction.type === type} onPress={() => onChange({ ...transaction, type })} />)}</View>
          </View>
          <Field label="Amount" keyboardType="decimal-pad" value={transaction.amount} onChangeText={(amount) => onChange({ ...transaction, amount })} />
          <Field label="Date (YYYY-MM-DD)" value={transaction.date} onChangeText={(date) => onChange({ ...transaction, date })} />
          <Field label="Note" placeholder="What was this for?" value={transaction.note ?? ''} onChangeText={(note) => onChange({ ...transaction, note: note || null })} />
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Account</Text>
            <View style={styles.chips}>{accounts.map((account) => <ChoiceChip key={account.id} label={account.label} selected={transaction.accountId === account.id} onPress={() => onChange({ ...transaction, accountId: account.id })} />)}</View>
          </View>
          {transaction.type === 'transfer' ? <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Destination account</Text>
            <View style={styles.chips}>{accounts.filter((account) => account.id !== transaction.accountId).map((account) => <ChoiceChip key={account.id} label={account.label} selected={transaction.destinationAccountId === account.id} onPress={() => onChange({ ...transaction, destinationAccountId: account.id })} />)}</View>
          </View> : <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Category (optional)</Text>
            <View style={styles.chips}>{categories.filter((category) => category.type === transaction.type).map((category) => <ChoiceChip key={category.id} label={category.name} selected={transaction.categoryId === category.id} onPress={() => onChange({ ...transaction, categoryId: category.id })} />)}</View>
          </View>}
          <View style={styles.formActions}>
            <Button size="full" onPress={onSave}>{exists ? 'Save changes' : 'Add transaction'}</Button>
            <Button variant="outline" onPress={onCancel}>Cancel</Button>
          </View>
        </View> : null}
      </Screen>
    </Modal>
  );
}

function useTransactionsStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 20 },
  headingCopy: { flex: 1, minWidth: 0 },
  subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  listContent: { flexGrow: 1, paddingBottom: 32 },
  rowGroup: { gap: 0 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  rowDivider: { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
  rowPressed: { opacity: 0.74 },
  identityMark: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 18 },
  identityText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700' },
  transactionCopy: { flex: 1, minWidth: 0, gap: 2 },
  amount: { flexShrink: 0, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  income: { color: theme.income },
  expense: { color: theme.expense },
  editorHeader: { marginBottom: 24 },
  form: { gap: 0 },
  formSection: { marginBottom: 16 },
   fieldLabel: { marginBottom: 8, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  formActions: { gap: 12, marginTop: 8 },
  }), [theme]);
}

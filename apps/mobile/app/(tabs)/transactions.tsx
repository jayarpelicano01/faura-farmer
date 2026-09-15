import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAccount, MobileCategory, MobileTransaction } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import type { TransactionPageCursor } from '@/data/db';
import { localDateKey, transactionDateKey } from '@/data/date';
import { Button, ChoiceChip, Empty, Field, Screen, Title, useUiStyles } from '@/ui/primitives';
import { ContentSkeleton } from '@/ui/loading';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useCurrency } from '@/ui/currency';
import { useSync } from '@/sync/use-sync';
import { useLocalSearchParams, useRouter } from 'expo-router';

type NewTransactionType = Extract<MobileTransaction['type'], 'income' | 'expense' | 'transfer'>;

const TRANSACTION_PAGE_SIZE = 20;

function blankTransaction(accountId: string, type: NewTransactionType = 'expense'): MobileTransaction {
  return { id: Crypto.randomUUID(), accountId, categoryId: null, bucket: null, amount: '', type, destinationAccountId: null, date: localDateKey(), note: null, updatedAt: new Date().toISOString() };
}

function requestedTransactionType(value: string | string[] | undefined): NewTransactionType | null {
  const type = Array.isArray(value) ? value[0] : value;
  return type === 'income' || type === 'expense' || type === 'transfer' ? type : null;
}

function accountName(accounts: MobileAccount[], id: string | null) {
  return accounts.find((account) => account.id === id)?.label ?? 'Unknown account';
}

function categoryName(categories: MobileCategory[], id: string | null) {
  return categories.find((category) => category.id === id)?.name;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string | string[] }>();
  const { theme } = useAppTheme();
  const styles = useTransactionsStyles();
  const ui = useUiStyles();
  const { db } = useWorkspace();
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const { accounts, categories, reload } = useWorkspaceData();
  const [editing, setEditing] = useState<MobileTransaction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [nextCursor, setNextCursor] = useState<TransactionPageCursor | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const handledRouteType = useRef<NewTransactionType | null>(null);
  const pageRequestVersion = useRef(0);
  const loadingMore = useRef(false);
  const { syncNow } = useSync();
  const { convert, displayCurrency, formatMoney: formatDisplayMoney } = useCurrency();
  const load = useCallback(async () => {
    const requestVersion = ++pageRequestVersion.current;
    loadingMore.current = false;
    setIsLoadingMore(false);
    const page = await db.listTransactionPage({ limit: TRANSACTION_PAGE_SIZE });
    if (requestVersion !== pageRequestVersion.current) return;
    setTransactions(page.items);
    setNextCursor(page.nextCursor);
    setLoaded(true);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursor;
    if (!cursor || loadingMore.current) return;
    const requestVersion = pageRequestVersion.current;
    loadingMore.current = true;
    setIsLoadingMore(true);
    try {
      const page = await db.listTransactionPage({ cursor, limit: TRANSACTION_PAGE_SIZE });
      if (requestVersion !== pageRequestVersion.current) return;
      setTransactions((current) => {
        const knownIds = new Set(current.map((transaction) => transaction.id));
        return [...current, ...page.items.filter((transaction) => !knownIds.has(transaction.id))];
      });
      setNextCursor(page.nextCursor);
    } finally {
      if (requestVersion === pageRequestVersion.current) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [nextCursor]);

  const begin = useCallback((newType: NewTransactionType = 'expense') => {
    if (accounts.length) {
      setEditing(blankTransaction(accounts[0].id, newType));
      return;
    }
    Alert.alert('Add an account first', 'Transactions need an account.');
  }, [accounts]);

  useEffect(() => {
    const routeType = requestedTransactionType(type);
    if (!routeType) {
      handledRouteType.current = null;
      return;
    }
    if (!loaded || handledRouteType.current === routeType) return;
    handledRouteType.current = routeType;
    begin(routeType);
    router.setParams({ type: undefined });
  }, [begin, loaded, router, type]);
  const save = async () => {
    if (!editing || !/^\d+(\.\d{1,2})?$/.test(editing.amount) || !editing.accountId || !transactionDateKey(editing.date)) {
      Alert.alert('Check this transaction', 'An account, valid amount, and valid date are required. Use YYYY-MM-DD for the date.');
      return;
    }
    if (editing.type === 'transfer' && (!editing.destinationAccountId || editing.destinationAccountId === editing.accountId)) {
      Alert.alert('Choose another account', 'Transfers need a different destination account.');
      return;
    }
    const sourceCurrency = accounts.find((account) => account.id === editing.accountId)?.currency ?? 'PHP';
    const record = { ...editing, amount: convert(editing.amount, displayCurrency, sourceCurrency), date: transactionDateKey(editing.date)!, categoryId: editing.type === 'transfer' ? null : editing.categoryId, bucket: editing.type === 'transfer' ? null : editing.bucket, destinationAccountId: editing.type === 'transfer' ? editing.destinationAccountId : null, updatedAt: new Date().toISOString() };
    await db.queueUpsert('transaction', record);
    setEditing(null);
    await Promise.all([load(), reload()]);
    void syncNow();
  };
  const remove = (id: string) => Alert.alert('Delete transaction?', 'This will synchronize as a deletion when online.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void db.queueDelete('transaction', id).then(() => Promise.all([load(), reload()])).then(() => syncNow()); } },
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
      <FlatList
        accessibilityLabel="Transactions"
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        data={transactions}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={loaded ? <Empty>Income, expenses, and transfers work offline.</Empty> : <ContentSkeleton variant="rows" />}
        ListFooterComponent={transactions.length > 0 ? (
          <View accessibilityLiveRegion="polite" style={styles.listFooter}>
            {isLoadingMore ? (
              <>
                <ActivityIndicator color={theme.primary} size="small" />
                <Text style={ui.listMeta}>Loading more transactions...</Text>
              </>
            ) : nextCursor ? (
              <Text style={ui.listMeta}>Scroll down to load 20 more</Text>
            ) : (
              <Text style={ui.listMeta}>All transactions shown</Text>
            )}
          </View>
        ) : null}
        onEndReached={() => { void loadMore(); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => {
          const source = accounts.find((account) => account.id === item.accountId);
          const label = item.type === 'transfer' && item.destinationAccountId
            ? `${accountName(accounts, item.accountId)} \u2192 ${accountName(accounts, item.destinationAccountId)}`
            : accountName(accounts, item.accountId);
          const detail = item.type === 'transfer'
            ? 'Transfer'
            : categoryName(categories, item.categoryId) ?? item.type;
          const currency = source?.currency ?? 'PHP';
          return (
            <Pressable
              accessibilityHint="Double tap to edit. Press and hold to delete."
              accessibilityLabel={`${label}, ${item.type}, ${formatDisplayMoney(item.amount, currency)}`}
              accessibilityRole="button"
              onLongPress={() => remove(item.id)}
              onPress={() => setEditing({ ...item, amount: convert(item.amount, currency) })}
            >
              {({ pressed }) => (
                <View style={[styles.transactionRow, index > 0 ? styles.rowDivider : undefined, pressed ? styles.rowPressed : undefined]}>
                  <View style={[styles.identityMark, { backgroundColor: source?.color ?? theme.primary }]}>
                    <Text style={styles.identityText}>{label.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.transactionCopy}>
                    <Text numberOfLines={1} style={ui.listTitle}>{item.note?.trim() || label}</Text>
                    <Text numberOfLines={1} style={ui.listMeta}>{item.date} {'\u00B7'} {detail}</Text>
                  </View>
                  <Text style={[styles.amount, item.type === 'income' ? styles.income : item.type === 'expense' ? styles.expense : undefined]}>
                    {item.type === 'income' ? '+' : item.type === 'expense' ? '\u2212' : ''}{formatDisplayMoney(item.amount, currency)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />

      <Button variant="outline" onPress={() => router.replace('/(tabs)/dashboard')}>Done</Button>

      <TransactionEditor accounts={accounts} categories={categories} displayCurrency={displayCurrency} exists={transactions.some((item) => item.id === editing?.id)} transaction={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={() => void save()} />
    </Screen>
  );
}

function TransactionEditor({ accounts, categories, displayCurrency, exists, transaction, onChange, onCancel, onSave }: { accounts: MobileAccount[]; categories: MobileCategory[]; displayCurrency: string; exists: boolean; transaction: MobileTransaction | null; onChange: (transaction: MobileTransaction) => void; onCancel: () => void; onSave: () => void }) {
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
          <Field label={`Amount (${displayCurrency})`} keyboardType="decimal-pad" value={transaction.amount} onChangeText={(amount) => onChange({ ...transaction, amount })} />
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
  list: { flex: 1, marginBottom: 12, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, backgroundColor: theme.card, paddingHorizontal: 16 },
  listContent: { flexGrow: 1, paddingBottom: 16 },
  listFooter: { alignItems: 'center', gap: 8, paddingTop: 20, paddingBottom: 4 },
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import type { BudgetBucket, MobileAccount, MobileBudget, MobileCategory, MobileMonthlyBudget, MobileTransaction } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { Button, Card, ChoiceChip, Empty, Field, Screen, Title, useUiStyles } from '@/ui/primitives';
import { useSync } from '@/sync/use-sync';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useCurrency } from '@/ui/currency';

type BudgetEditor = { id: string | null; categoryId: string; monthlyLimit: string };

const BUCKETS: Array<{ key: BudgetBucket; label: string; share: number; description: string }> = [
  { key: 'needs', label: 'Needs', share: 0.5, description: 'Housing, food, and bills' },
  { key: 'wants', label: 'Wants', share: 0.3, description: 'Lifestyle and extras' },
  { key: 'savings', label: 'Savings', share: 0.2, description: 'Goals and future plans' },
];

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function amount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function descendantsOf(categoryId: string, categories: MobileCategory[]) {
  const ids = new Set<string>([categoryId]);
  const pending = [categoryId];
  while (pending.length) {
    const parentId = pending.pop()!;
    for (const category of categories) {
      if (category.parentId === parentId && !ids.has(category.id)) {
        ids.add(category.id);
        pending.push(category.id);
      }
    }
  }
  return ids;
}

function relatedCategories(categoryId: string, categories: MobileCategory[]) {
  const related = descendantsOf(categoryId, categories);
  const byId = new Map(categories.map((category) => [category.id, category]));
  let parentId = byId.get(categoryId)?.parentId;
  while (parentId) {
    related.add(parentId);
    parentId = byId.get(parentId)?.parentId;
  }
  return related;
}

function bucketFor(categoryId: string | null, categories: MobileCategory[]): BudgetBucket | null {
  if (!categoryId) return null;
  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = byId.get(categoryId);
  let guard = 0;
  while (current && guard <= categories.length) {
    if (current.bucket) return current.bucket;
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }
  return null;
}

export default function BudgetsScreen() {
  const { new: newParam } = useLocalSearchParams<{ new?: string | string[] }>();
  const { theme } = useAppTheme();
  const styles = useBudgetStyles();
  const ui = useUiStyles();
  const { db } = useWorkspace();
  const { syncNow } = useSync();
  const { convert, displayCurrency, formatMoney: formatDisplayMoney } = useCurrency();
  const [budgets, setBudgets] = useState<MobileBudget[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MobileMonthlyBudget[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [editor, setEditor] = useState<BudgetEditor | null>(null);
  const [monthlyEditor, setMonthlyEditor] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [loaded, setLoaded] = useState(false);
  const handledNewParam = useRef(false);

  const load = useCallback(async () => {
    const [nextBudgets, nextMonthlyBudgets, nextCategories, nextTransactions, nextAccounts] = await Promise.all([
      db.listRecords('budget'),
      db.listRecords('monthly_budget'),
      db.listRecords('category'),
      db.listRecords('transaction'),
      db.listRecords('account'),
    ]);
    setBudgets(nextBudgets);
    setMonthlyBudgets(nextMonthlyBudgets);
    setCategories(nextCategories);
    setTransactions(nextTransactions);
    setAccounts(nextAccounts);
    setLoaded(true);
  }, [db]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (newParam !== '1' || !loaded || handledNewParam.current) return;
    handledNewParam.current = true;
    setEditor({ id: null, categoryId: '', monthlyLimit: '' });
  }, [loaded, newParam]);

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(monthPrefix));
  const fallbackMonthlyBudget = monthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const monthlyBudget = monthlyBudgets[0];
  const monthlyLimit = monthlyBudget ? amount(monthlyBudget.amount) : fallbackMonthlyBudget;
  const totalBudgetLimits = budgets.reduce((sum, budget) => sum + amount(budget.monthlyLimit), 0);

  const spendingFor = useCallback((categoryId: string) => {
    const categoryIds = descendantsOf(categoryId, categories);
    return monthTransactions
      .filter((transaction) => transaction.type === 'expense' && transaction.categoryId && categoryIds.has(transaction.categoryId))
      .reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  }, [categories, monthTransactions]);

  const bucketSpending = useMemo(() => {
    const totals: Record<BudgetBucket, number> = { needs: 0, wants: 0, savings: 0 };
    for (const transaction of monthTransactions) {
      if (transaction.type !== 'expense') continue;
      const bucket = bucketFor(transaction.categoryId, categories);
      if (bucket) totals[bucket] += amount(transaction.amount);
    }
    return totals;
  }, [categories, monthTransactions]);

  const openNew = () => setEditor({ id: null, categoryId: '', monthlyLimit: '' });
  const openEdit = (budget: MobileBudget) => setEditor({ id: budget.id, categoryId: budget.categoryId, monthlyLimit: convert(budget.monthlyLimit, 'PHP') });

  const saveBudget = async () => {
    if (!editor || !editor.categoryId || !/^\d+(\.\d{1,2})?$/.test(editor.monthlyLimit) || amount(editor.monthlyLimit) <= 0) {
      Alert.alert('Check this budget', 'Choose an expense category and enter a positive monthly limit.');
      return;
    }
    const category = expenseCategories.find((item) => item.id === editor.categoryId);
    if (!category) {
      Alert.alert('Check this budget', 'Budgets can only be set on expense categories.');
      return;
    }
    const related = relatedCategories(editor.categoryId, categories);
    const conflict = budgets.find((budget) => budget.id !== editor.id && related.has(budget.categoryId));
    if (conflict) {
      const conflictName = categories.find((item) => item.id === conflict.categoryId)?.name ?? 'another category';
      Alert.alert('Budget conflict', `A budget already exists for ${conflictName} or a related category.`);
      return;
    }
    await db.queueUpsert('budget', {
      id: editor.id ?? Crypto.randomUUID(),
      categoryId: editor.categoryId,
      monthlyLimit: convert(editor.monthlyLimit, displayCurrency, 'PHP'),
      updatedAt: new Date().toISOString(),
    });
    setEditor(null);
    await load();
    void syncNow();
  };

  const saveMonthlyBudget = async () => {
    if (!/^\d+(\.\d{1,2})?$/.test(monthlyAmount) || amount(monthlyAmount) <= 0) {
      Alert.alert('Check this budget', 'Enter a positive monthly budget amount.');
      return;
    }
    await db.queueUpsert('monthly_budget', {
      id: monthlyBudget?.id ?? Crypto.randomUUID(),
      amount: convert(monthlyAmount, displayCurrency, 'PHP'),
      updatedAt: new Date().toISOString(),
    });
    setMonthlyEditor(false);
    await load();
    void syncNow();
  };

  const remove = (budget: MobileBudget) => Alert.alert('Delete budget?', 'This will synchronize as a deletion when online.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void db.queueDelete('budget', budget.id).then(load).then(() => syncNow()); } },
  ]);

  return (
    <Screen scrollable>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Budgets</Title>
          <Text style={styles.subtitle}>Plan monthly spending with category limits.</Text>
        </View>
        <Button accessibilityLabel="Create a new budget" onPress={openNew} size="compact">New</Button>
      </View>

      <Card>
        <View style={styles.monthlyHeader}>
          <View>
            <Text style={styles.sectionTitle}>Monthly budget</Text>
            <Text style={styles.monthlyAmount}>{formatDisplayMoney(monthlyLimit, 'PHP')}</Text>
            <Text style={ui.listMeta}>{monthlyBudget ? 'Your target household budget.' : "Defaults to this month's income."}</Text>
          </View>
          <Button size="compact" variant="outline" onPress={() => { setMonthlyAmount(monthlyBudget ? convert(monthlyBudget.amount, 'PHP') : (fallbackMonthlyBudget ? convert(String(fallbackMonthlyBudget), 'PHP') : '')); setMonthlyEditor(true); }}>Edit</Button>
        </View>
        <View style={styles.bucketList}>
          {BUCKETS.map((bucket) => {
            const limit = monthlyLimit * bucket.share;
            const spent = bucketSpending[bucket.key];
            const over = spent > limit;
            return <View key={bucket.key} style={styles.bucketRow}>
              <View style={[styles.bucketDot, { backgroundColor: bucket.key === 'needs' ? theme.income : bucket.key === 'wants' ? theme.primary : theme.secondaryForeground }]} />
              <View style={styles.bucketCopy}>
                <Text style={ui.listTitle}>{bucket.label}</Text>
                <Text style={ui.listMeta}>{bucket.description}</Text>
                <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${Math.min(limit ? (spent / limit) * 100 : 0, 100)}%`, backgroundColor: over ? theme.expense : theme.income }]} /></View>
                <Text style={ui.listMeta}>{formatDisplayMoney(spent, 'PHP')} of {formatDisplayMoney(limit, 'PHP')} {over ? 'spent' : 'spent'}</Text>
              </View>
            </View>;
          })}
        </View>
        {totalBudgetLimits > monthlyLimit ? <View style={styles.warning}><Text style={styles.warningText}>Your category limits exceed the monthly budget by {formatDisplayMoney(totalBudgetLimits - monthlyLimit, 'PHP')}.</Text></View> : null}
      </Card>

      {budgets.length === 0 ? <Empty>Set budgets to track your spending limits.</Empty> : budgets.map((budget) => {
        const category = categories.find((item) => item.id === budget.categoryId);
        const spent = spendingFor(budget.categoryId);
        const limit = amount(budget.monthlyLimit);
        const over = spent > limit;
        return <Card key={budget.id}>
          <Pressable accessibilityHint="Double tap to edit. Press and hold to delete." accessibilityLabel={`${category?.name ?? 'Unknown category'} budget`} accessibilityRole="button" onLongPress={() => remove(budget)} onPress={() => openEdit(budget)}>
            {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>
              <View style={styles.cardHeader}>
                <View style={[styles.categoryMark, { backgroundColor: category?.color ?? theme.primary }]}><Text style={styles.categoryMarkText}>{(category?.name ?? '?').charAt(0).toUpperCase()}</Text></View>
                <View style={styles.cardCopy}><Text style={ui.listTitle}>{category?.name ?? 'Unknown category'}</Text><Text style={ui.listMeta}>{formatDisplayMoney(spent, 'PHP')} of {formatDisplayMoney(limit, 'PHP')} spent</Text></View>
                <Text style={[styles.status, over ? styles.over : undefined]}>{over ? 'Over' : `${Math.round(limit ? (spent / limit) * 100 : 0)}%`}</Text>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${Math.min(limit ? (spent / limit) * 100 : 0, 100)}%`, backgroundColor: over ? theme.expense : theme.income }]} /></View>
              <Text style={ui.listMeta}>{over ? `${formatDisplayMoney(spent - limit, 'PHP')} over` : `${formatDisplayMoney(limit - spent, 'PHP')} left`}</Text>
            </View>}
          </Pressable>
        </Card>;
      })}

      <BudgetEditor displayCurrency={displayCurrency} categories={expenseCategories} editor={editor} onCancel={() => setEditor(null)} onChange={setEditor} onSave={() => void saveBudget()} />
      <Modal animationType="slide" onRequestClose={() => setMonthlyEditor(false)} presentationStyle="formSheet" visible={monthlyEditor}>
        <Screen scrollable>
          <View style={styles.editorHeader}><Title>Monthly budget</Title><Text style={styles.subtitle}>Set the amount used for the 50 / 30 / 20 guide.</Text></View>
          <Field label="Amount" keyboardType="decimal-pad" placeholder="e.g. 30000" value={monthlyAmount} onChangeText={setMonthlyAmount} />
          <View style={styles.formActions}><Button size="full" onPress={() => void saveMonthlyBudget()}>Save</Button><Button variant="outline" onPress={() => setMonthlyEditor(false)}>Cancel</Button></View>
        </Screen>
      </Modal>
    </Screen>
  );
}

function BudgetEditor({ displayCurrency, categories, editor, onCancel, onChange, onSave }: { displayCurrency: string; } & { categories: MobileCategory[]; editor: BudgetEditor | null; onCancel: () => void; onChange: (value: BudgetEditor) => void; onSave: () => void }) {
  const styles = useBudgetStyles();
  return <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="formSheet" visible={Boolean(editor)}>
    <Screen scrollable>
      <View style={styles.editorHeader}><Title>{editor?.id ? 'Edit budget' : 'New budget'}</Title><Text style={styles.subtitle}>Set a monthly limit for an expense category.</Text></View>
      {editor ? <View>
        <View style={styles.formSection}><Text style={styles.fieldLabel}>Category</Text><View style={styles.chips}>{categories.map((category) => <ChoiceChip key={category.id} label={category.name} selected={editor.categoryId === category.id} onPress={() => onChange({ ...editor, categoryId: category.id })} />)}</View></View>
        <Field label={`Monthly limit (${displayCurrency})`} keyboardType="decimal-pad" placeholder="e.g. 5000" value={editor.monthlyLimit} onChangeText={(monthlyLimit) => onChange({ ...editor, monthlyLimit })} />
        <View style={styles.formActions}><Button size="full" onPress={onSave}>{editor.id ? 'Save changes' : 'Add budget'}</Button><Button variant="outline" onPress={onCancel}>Cancel</Button></View>
      </View> : null}
    </Screen>
  </Modal>;
}

function useBudgetStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 20 },
    headingCopy: { flex: 1, minWidth: 0 },
    subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
    sectionTitle: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: 17, fontWeight: '600' },
    monthlyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    monthlyAmount: { marginTop: 8, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 28, fontWeight: '600', letterSpacing: -1 },
    bucketList: { gap: 16, marginTop: 20 },
    bucketRow: { flexDirection: 'row', gap: 10 },
    bucketDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
    bucketCopy: { flex: 1, minWidth: 0 },
    progressTrack: { height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: theme.accent, marginTop: 9, marginBottom: 7 },
    progressBar: { height: '100%', borderRadius: 99 },
    warning: { marginTop: 18, borderRadius: 12, backgroundColor: theme.accent, padding: 12 },
    warningText: { color: theme.expense, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    categoryMark: { alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 19 },
    categoryMarkText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700' },
    cardCopy: { flex: 1, minWidth: 0, gap: 2 },
    status: { color: theme.income, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700' },
    over: { color: theme.expense },
    pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
    editorHeader: { marginBottom: 24 },
    formSection: { marginBottom: 16 },
    fieldLabel: { marginBottom: 8, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    formActions: { gap: 12, marginTop: 8 },
  }), [theme]);
}

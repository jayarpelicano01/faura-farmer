import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useFocusEffect } from 'expo-router';
import type { MobileAccount, MobileBudget, MobileCategory, MobileTransaction } from '@faura-farmer/types';
import { buildBalanceTimeline, buildBudgetVariance, buildCategoryComparison, buildCategorySpending, categorySpendingRange, defaultCategoryAnchor, type BalancePoint, type BalanceTimelinePeriod, type CategorySpendingPeriod } from '@/data/reports';
import { useWorkspace } from '@/data/workspace-provider';
import { Button, Card, ChoiceChip, Empty, Field, Screen, SectionTitle, Spinner, Title, useUiStyles } from '@/ui/primitives';
import { useSync } from '@/sync/use-sync';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useCurrency } from '@/ui/currency';

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency} ${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
  }
}

function signedMoney(value: string, currency: string) {
  return `${Number(value) > 0 ? '+' : ''}${formatMoney(value, currency)}`;
}

function compactMoney(value: string, currency: string) {
  const amount = Number(value);
  const prefix = currency === 'PHP' ? '₱' : `${currency} `;
  if (Math.abs(amount) >= 1_000_000) return `${prefix}${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${prefix}${(amount / 1_000).toFixed(1)}K`;
  return `${prefix}${Math.round(amount)}`;
}

function lastSyncedCopy(value: string | null) {
  if (!value) return 'Not synced yet. This report uses data saved on this device.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'This report uses data saved on this device.';
  return `Last synced ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
}

function validCategoryAnchor(period: CategorySpendingPeriod, value: string) {
  return categorySpendingRange(period, value) !== null;
}

export default function ReportsScreen() {
  const { theme } = useAppTheme();
  const styles = useReportStyles();
  const ui = useUiStyles();
  const { db, activeWorkspace } = useWorkspace();
  const { syncNow, syncStatus } = useSync();
  const {
    displayCurrency,
    usdPerPhp,
    rateDate,
    rateRefreshedAt,
    formatMoney: formatDisplayMoney,
  } = useCurrency();
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [budgets, setBudgets] = useState<MobileBudget[]>([]);
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [timelinePeriod, setTimelinePeriod] = useState<BalanceTimelinePeriod>('7d');
  const [selectedPoint, setSelectedPoint] = useState<BalancePoint | null>(null);
  const [categoryPeriod, setCategoryPeriod] = useState<CategorySpendingPeriod>('month');
  const [categoryAnchor, setCategoryAnchor] = useState(() => defaultCategoryAnchor('month'));
  const [categoryAnchorInput, setCategoryAnchorInput] = useState(() => defaultCategoryAnchor('month'));
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAccounts, nextCategories, nextBudgets, nextTransactions, nextLastSyncedAt] = await Promise.all([
        db.listRecords('account'),
        db.listRecords('category'),
        db.listRecords('budget'),
        db.listRecords('transaction'),
        db.getLastSyncedAt(),
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setBudgets(nextBudgets);
      setTransactions(nextTransactions);
      setLastSyncedAt(nextLastSyncedAt);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { if (syncStatus === 'success') void load(); }, [load, syncStatus]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts.find((account) => !account.isArchived) ?? accounts[0] ?? null;
  useEffect(() => {
    if (selectedAccount && selectedAccount.id !== selectedAccountId) setSelectedAccountId(selectedAccount.id);
  }, [selectedAccount, selectedAccountId]);

  const preference = useMemo(
    () => ({ displayCurrency, usdPerPhp, rateDate, rateRefreshedAt }),
    [displayCurrency, rateDate, rateRefreshedAt, usdPerPhp],
  );
  const timeline = useMemo(() => selectedAccount
    ? buildBalanceTimeline({ account: selectedAccount, accounts, categories, transactions, period: timelinePeriod, preference })
    : [], [accounts, categories, preference, selectedAccount, timelinePeriod, transactions]);
  const categorySpending = useMemo(() => selectedAccount
    ? buildCategorySpending({ accountId: selectedAccount.id, accountCurrency: selectedAccount.currency, preference, categories, transactions, period: categoryPeriod, anchor: categoryAnchor })
    : [], [categoryAnchor, categoryPeriod, categories, preference, selectedAccount, transactions]);
  const budgetVariance = useMemo(() => buildBudgetVariance({ accounts, preference, budgets, categories, transactions, period: categoryPeriod, anchor: categoryAnchor }), [accounts, budgets, categoryAnchor, categoryPeriod, categories, preference, transactions]);
  const categoryComparison = useMemo(() => buildCategoryComparison({ accounts, preference, categories, transactions, period: categoryPeriod, anchor: categoryAnchor }), [accounts, categoryAnchor, categoryPeriod, categories, preference, transactions]);
  useEffect(() => { setSelectedPoint(timeline.at(-1) ?? null); }, [timeline]);

  const changeCategoryPeriod = (period: CategorySpendingPeriod) => {
    const next = defaultCategoryAnchor(period);
    setCategoryPeriod(period);
    setCategoryAnchor(next);
    setCategoryAnchorInput(next);
    setCategoryError(null);
  };

  const applyCategoryRange = () => {
    if (!validCategoryAnchor(categoryPeriod, categoryAnchorInput)) {
      setCategoryError(categoryPeriod === 'week' ? 'Use a week-ending date in YYYY-MM-DD format.' : 'Use a month in YYYY-MM format.');
      return;
    }
    setCategoryError(null);
    setCategoryAnchor(categoryAnchorInput);
  };

  return (
    <Screen scrollable>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}><Title>Reports</Title><Text style={styles.subtitle}>Your balances and spending, calculated on this device.</Text></View>
        {activeWorkspace === 'online' ? (
          <Button accessibilityLabel="Sync report data" onPress={() => void syncNow(true)} size="compact" variant="outline">Sync</Button>
        ) : null}
      </View>
      <Text style={styles.syncCopy}>{lastSyncedCopy(lastSyncedAt)}</Text>

      {loading && accounts.length === 0 ? <View style={styles.loading}><Spinner size={24} /><Text style={ui.listMeta}>Loading local reports…</Text></View> : null}
      {!loading && accounts.length === 0 ? <Empty>Add an account and transactions to see your reports.</Empty> : null}

      {selectedAccount ? <View>
        <Card>
          <SectionTitle>Account</SectionTitle><Text style={ui.listMeta}>Choose the account whose balance movement you want to inspect.</Text>
          <View style={styles.chips}>{accounts.map((account) => <ChoiceChip key={account.id} label={`${account.label}${account.isArchived ? ' (archived)' : ''}`} selected={selectedAccount.id === account.id} onPress={() => setSelectedAccountId(account.id)} />)}</View>
        </Card>

        <Card>
          <SectionTitle>Balance movement</SectionTitle><Text style={ui.listMeta}>{selectedAccount.label} · shown in {displayCurrency} · Starting balance is included.</Text>
          <View style={styles.chips}>
            <ChoiceChip label="Past 7 days" selected={timelinePeriod === '7d'} onPress={() => setTimelinePeriod('7d')} />
            <ChoiceChip label="Past 30 days" selected={timelinePeriod === '30d'} onPress={() => setTimelinePeriod('30d')} />
            <ChoiceChip label="Past year" selected={timelinePeriod === '365d'} onPress={() => setTimelinePeriod('365d')} />
          </View>
          <LineChart
            adjustToWidth color={theme.primary} curved
            data={timeline.map((point) => ({ label: point.label, value: Number(point.balance), onPress: () => setSelectedPoint(point) }))}
            disableScroll height={190} initialSpacing={12} noOfSections={4} rulesColor={theme.border}
            spacing={timelinePeriod === '365d' ? 24 : 38} textColor={theme.mutedForeground} textFontSize={20} thickness={3}
             xAxisColor={theme.border} xAxisLabelTextStyle={{ color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 10 }} yAxisColor={theme.border}
            yAxisTextStyle={{ color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 10 }} dataPointsColor='white'
            formatYLabel={(label) => compactMoney(label, displayCurrency)}
          />
          <View style={styles.pointList}>{timeline.map((point) => <Pressable key={point.id} accessibilityLabel={`Show activity for ${point.label}`} accessibilityRole="button" onPress={() => setSelectedPoint(point)}>{({ pressed }) => <View style={[styles.pointRow, selectedPoint?.id === point.id ? styles.pointRowSelected : undefined, pressed ? styles.pressed : undefined]}><Text style={styles.pointLabel}>{point.label}</Text><View style={styles.pointValues}><Text style={styles.pointBalance}>{formatMoney(point.balance, displayCurrency)}</Text><Text style={[ui.listMeta, Number(point.change) < 0 ? styles.expense : Number(point.change) > 0 ? styles.income : undefined]}>{signedMoney(point.change, displayCurrency)}</Text></View></View>}</Pressable>)}</View>
        </Card>

        <Card>
          <SectionTitle>{selectedPoint ? `What changed on ${selectedPoint.label}` : 'What changed'}</SectionTitle>
          {selectedPoint ? <Text style={ui.listMeta}>{selectedPoint.from === selectedPoint.to ? selectedPoint.from : `${selectedPoint.from} to ${selectedPoint.to}`} · Closing balance {formatMoney(selectedPoint.balance, displayCurrency)}</Text> : null}
          <View style={styles.eventList}>{!selectedPoint?.events.length ? <Text style={ui.listMeta}>No transactions changed this balance point.</Text> : selectedPoint.events.map((event, index) => <View key={event.id} style={[styles.eventRow, index > 0 ? styles.rowDivider : undefined]}><View style={[styles.eventDot, { backgroundColor: event.kind === 'income' || event.kind === 'transfer_in' ? theme.income : theme.expense }]} /><View style={styles.eventCopy}><Text numberOfLines={1} style={ui.listTitle}>{event.description}</Text><Text style={ui.listMeta}>{event.date} · Balance {formatMoney(event.balanceAfter, displayCurrency)}</Text></View><Text style={[styles.eventAmount, Number(event.change) >= 0 ? styles.income : styles.expense]}>{signedMoney(event.change, displayCurrency)}</Text></View>)}</View>
        </Card>

        <Card>
          <SectionTitle>Spending by category</SectionTitle><Text style={ui.listMeta}>Expense categories for {selectedAccount.label}.</Text>
          {categorySpending.length === 0 ? <View style={styles.emptyChart}><Text style={ui.listMeta}>No categorized expenses were saved for this period.</Text></View> : <>
            <BarChart adjustToWidth barWidth={26} data={categorySpending.slice(0, 6).map((item) => ({ label: item.categoryName.slice(0, 8), value: Number(item.amount), frontColor: item.color ?? theme.primary }))} disableScroll height={190} initialSpacing={12} noOfSections={4} rulesColor={theme.border} xAxisColor={theme.border} yAxisColor={theme.border} yAxisTextStyle={{ color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 10 }} formatYLabel={(label) => compactMoney(label, displayCurrency)} />
            <View style={styles.categoryList}>{categorySpending.map((item) => <View key={item.categoryName} style={styles.categoryRow}><View style={[styles.eventDot, { backgroundColor: item.color ?? theme.primary }]} /><Text style={ui.listTitle}>{item.categoryName}</Text><Text style={styles.categoryAmount}>{formatMoney(item.amount, displayCurrency)}</Text></View>)}</View>
          </>}
        </Card>
        <View style={styles.scopeDivider}><View style={styles.dividerLine} /><Text style={styles.dividerLabel}>All accounts</Text><View style={styles.dividerLine} /></View>
        <Card>
          <SectionTitle>All-account spending period</SectionTitle><Text style={ui.listMeta}>These reports include every expense from every account, shown in {displayCurrency}.</Text>
          <View style={styles.chips}><ChoiceChip label="Week" selected={categoryPeriod === 'week'} onPress={() => changeCategoryPeriod('week')} /><ChoiceChip label="Month" selected={categoryPeriod === 'month'} onPress={() => changeCategoryPeriod('month')} /></View>
          <Field label={categoryPeriod === 'week' ? 'Week ending (YYYY-MM-DD)' : 'Month (YYYY-MM)'} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={categoryPeriod === 'week' ? 10 : 7} onChangeText={setCategoryAnchorInput} value={categoryAnchorInput} />
          <Button size="compact" variant="outline" onPress={applyCategoryRange}>Apply range</Button>
          {categoryError ? <Text style={styles.errorText}>{categoryError}</Text> : null}
        </Card>
        <Card>
          <SectionTitle>Budget vs actual</SectionTitle><Text style={ui.listMeta}>Current budget settings compared with all-account {categoryPeriod === 'week' ? 'month-to-date spending' : 'spending in the selected month'}.</Text>
          <View style={styles.eventList}>{budgetVariance.length === 0 ? <Text style={ui.listMeta}>No budget limits or expense activity were saved for this period.</Text> : budgetVariance.map((row, index) => <View key={row.id} style={[styles.eventRow, index > 0 ? styles.rowDivider : undefined]}><View style={[styles.eventDot, { backgroundColor: row.color ?? (row.over ? theme.expense : theme.primary) }]} /><View style={styles.eventCopy}><Text numberOfLines={1} style={ui.listTitle}>{row.categoryName}</Text><Text style={ui.listMeta}>{row.limit === '0' ? formatDisplayMoney(row.spent, displayCurrency) : `${formatDisplayMoney(row.spent, displayCurrency)} of ${formatDisplayMoney(row.limit, displayCurrency)} spent`}</Text></View><Text style={[styles.eventAmount, row.over ? styles.expense : styles.income]}>{row.over ? `${formatDisplayMoney(String(Math.abs(Number(row.remaining))), displayCurrency)} over` : `${formatDisplayMoney(row.remaining, displayCurrency)} left`}</Text></View>)}</View>
        </Card>

        <Card>
          <SectionTitle>Spending comparison</SectionTitle><Text style={ui.listMeta}>{categoryPeriod === 'week' ? 'All-account spending for the selected week compared with the preceding 7 days.' : 'All-account spending for the selected month compared with the preceding month.'}</Text>
          <View style={styles.eventList}>{categoryComparison.length === 0 ? <Text style={ui.listMeta}>No expenses were saved in either comparison period.</Text> : categoryComparison.map((row, index) => <View key={row.categoryName} style={[styles.eventRow, index > 0 ? styles.rowDivider : undefined]}><View style={[styles.eventDot, { backgroundColor: row.color ?? theme.primary }]} /><View style={styles.eventCopy}><Text numberOfLines={1} style={ui.listTitle}>{row.categoryName}</Text><Text style={ui.listMeta}>{formatDisplayMoney(row.current, displayCurrency)} this period · {formatDisplayMoney(row.previous, displayCurrency)} before</Text></View><View style={styles.comparisonValue}><Text style={[styles.eventAmount, Number(row.change) > 0 ? styles.expense : Number(row.change) < 0 ? styles.income : undefined]}>{`${Number(row.change) > 0 ? '+' : ''}${formatDisplayMoney(row.change, displayCurrency)}`}</Text><Text style={ui.listMeta}>{row.percentageChange === null ? 'New' : `${row.percentageChange > 0 ? '+' : ''}${Math.round(row.percentageChange)}%`}</Text></View></View>)}</View>
        </Card>

      </View> : null}
    </Screen>
  );
}

function useReportStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
    headingCopy: { flex: 1, minWidth: 0 }, subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 }, syncCopy: { marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 }, loading: { alignItems: 'center', gap: 10, paddingVertical: 36 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginBottom: 4 }, pointList: { gap: 4, marginTop: 12 }, pointRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, pointRowSelected: { backgroundColor: theme.accent }, pointLabel: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' }, pointValues: { alignItems: 'flex-end', gap: 1 }, pointBalance: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    eventList: { marginTop: 16 }, eventRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, eventDot: { width: 9, height: 9, borderRadius: 5 }, eventCopy: { flex: 1, minWidth: 0, gap: 2 }, eventAmount: { flexShrink: 0, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }, rowDivider: { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
    scopeDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 }, dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border }, dividerLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    income: { color: theme.income }, expense: { color: theme.expense }, pressed: { opacity: 0.72 }, comparisonValue: { alignItems: 'flex-end', gap: 1 }, errorText: { marginTop: 8, color: theme.danger, fontFamily: fontFamily.body, fontSize: 12 }, emptyChart: { paddingTop: 18, paddingBottom: 8 }, categoryList: { gap: 10, marginTop: 12 }, categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, categoryAmount: { marginLeft: 'auto', color: theme.foreground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  }), [theme]);
}

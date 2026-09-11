import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAccount, MobileCategory, MobileRecurringRule, MobileTransaction } from '@faura-farmer/types';
import { useRouter } from 'expo-router';
import { LOCAL_PROFILE_ID } from '@/data/workspace';
import { localDateKey, transactionDateKey } from '@/data/date';
import { advanceRecurringDueDate, recurringSections } from '@/data/recurring';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import { useSession } from '@/auth/session';
import { useSync } from '@/sync/use-sync';
import { Badge, Button, Card, ChoiceChip, Empty, Field, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

function blankRule(accountId: string, userId: string): MobileRecurringRule {
  return { id: Crypto.randomUUID(), accountId, userId, categoryId: null, label: null, amount: '', type: 'expense', frequency: 'monthly', nextDueDate: localDateKey(), isActive: true, updatedAt: new Date().toISOString() };
}

function sourceMoney(amount: string, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount)); }
  catch { return `${currency} ${amount}`; }
}

export default function RecurringScreen() {
  const router = useRouter();
  const { activeWorkspace, db } = useWorkspace();
  const { session } = useSession();
  const { accounts, categories, recurringRules, reload } = useWorkspaceData();
  const { syncNow } = useSync();
  const [editing, setEditing] = useState<MobileRecurringRule | null>(null);
  const styles = useStyles();
  const ui = useUiStyles();
  const userId = activeWorkspace === 'local' ? LOCAL_PROFILE_ID : session?.user.id;
  const sections = useMemo(() => recurringSections(recurringRules, localDateKey()), [recurringRules]);

  const save = async () => {
    if (!editing || !userId || !editing.accountId || !/^\d+(\.\d{1,2})?$/.test(editing.amount) || !transactionDateKey(editing.nextDueDate)) {
      Alert.alert('Check this recurring rule', 'Account, amount, frequency, and a valid next due date are required. Use YYYY-MM-DD for the date.');
      return;
    }
    const record = { ...editing, userId, label: editing.label?.trim() || null, nextDueDate: transactionDateKey(editing.nextDueDate)!, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'local') await db.upsertLocal('recurring_rule', record);
    else await db.queueUpsert('recurring_rule', record);
    setEditing(null);
    await reload();
    if (activeWorkspace === 'online') void syncNow();
  };

  const remove = (rule: MobileRecurringRule) => Alert.alert('Delete this recurring rule?', 'Future scheduled occurrences will be removed.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      if (activeWorkspace === 'local') await db.hardDeleteLocal('recurring_rule', rule.id);
      else await db.queueDelete('recurring_rule', rule.id);
      setEditing(null);
      await reload();
      if (activeWorkspace === 'online') void syncNow();
    })(); } },
  ]);

  const toggle = (rule: MobileRecurringRule) => {
    const saveToggle = () => { void (async () => {
      const updated = { ...rule, isActive: !rule.isActive, updatedAt: new Date().toISOString() };
      if (activeWorkspace === 'local') await db.upsertLocal('recurring_rule', updated);
      else await db.queueUpsert('recurring_rule', updated);
      await reload();
      if (activeWorkspace === 'online') void syncNow();
    })(); };
    if (!rule.isActive) Alert.alert('Reactivate recurring rule?', 'It will become due again on its next due date.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reactivate', onPress: saveToggle }]);
    else saveToggle();
  };

  const occur = (rule: MobileRecurringRule, action: 'approve' | 'skip') => Alert.alert(
    action === 'approve' ? 'Approve recurring rule?' : 'Skip recurring rule?',
    action === 'approve' ? `${sourceMoney(rule.amount, accounts.find((account) => account.id === rule.accountId)?.currency ?? 'PHP')} will be recorded for ${accountName(accounts, rule.accountId)}.` : 'This advances the next due date without recording a transaction.',
    [{ text: 'Cancel', style: 'cancel' }, { text: action === 'approve' ? 'Approve' : 'Skip', onPress: () => { void (async () => {
      const advanced = { ...rule, nextDueDate: advanceRecurringDueDate(rule.nextDueDate, rule.frequency), updatedAt: new Date().toISOString() };
      const transaction: MobileTransaction | undefined = action === 'approve' ? {
        id: Crypto.randomUUID(), accountId: rule.accountId, categoryId: rule.categoryId, bucket: null, amount: rule.amount,
        type: rule.type, destinationAccountId: null, recurringRuleId: rule.id, date: rule.nextDueDate, note: rule.label, updatedAt: new Date().toISOString(),
      } : undefined;
      if (activeWorkspace === 'local') {
        if (transaction) await db.upsertLocal('transaction', transaction);
        await db.upsertLocal('recurring_rule', advanced);
      } else {
        await db.queueRecurringOccurrence({ action, expectedDueDate: rule.nextDueDate, rule: advanced, transaction });
      }
      await reload();
      if (activeWorkspace === 'online') void syncNow();
      Alert.alert(action === 'approve' ? 'Recurring transaction approved' : 'Recurring rule skipped');
    })(); } }],
  );

  if (!userId) return <Screen><Empty>Sign in to manage recurring rules.</Empty></Screen>;
  return <Screen>
    <View style={styles.header}><View style={styles.heading}><Title>Recurring</Title><Text style={styles.subtitle}>Review and schedule repeating income and expenses.</Text></View><Button size="compact" onPress={() => accounts.length ? setEditing(blankRule(accounts[0].id, userId)) : Alert.alert('Add an account first', 'Recurring rules need an account.')}>New</Button></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <RuleSection title="Due" rules={sections.due} accounts={accounts} categories={categories} due onApprove={(rule) => occur(rule, 'approve')} onSkip={(rule) => occur(rule, 'skip')} onEdit={setEditing} onToggle={toggle} onDelete={remove} />
      <RuleSection title="Active" rules={sections.active} accounts={accounts} categories={categories} onEdit={setEditing} onToggle={toggle} onDelete={remove} />
      <RuleSection title="Inactive" rules={sections.inactive} accounts={accounts} categories={categories} onEdit={setEditing} onToggle={toggle} onDelete={remove} />
      {recurringRules.length === 0 ? <Empty>Set up a recurring income or expense. It works offline too.</Empty> : null}
    </ScrollView>
    <Button variant="outline" onPress={() => router.replace('/(tabs)/dashboard')}>Done</Button>
    <RuleEditor accounts={accounts} categories={categories} exists={recurringRules.some((rule) => rule.id === editing?.id)} rule={editing} onCancel={() => setEditing(null)} onChange={setEditing} onDelete={remove} onSave={() => void save()} />
  </Screen>;
}

function accountName(accounts: MobileAccount[], id: string) { return accounts.find((account) => account.id === id)?.label ?? 'Unknown account'; }

function RuleSection({ title, rules, accounts, categories, due = false, onApprove, onSkip, onEdit, onToggle, onDelete }: { title: string; rules: MobileRecurringRule[]; accounts: MobileAccount[]; categories: MobileCategory[]; due?: boolean; onApprove?: (rule: MobileRecurringRule) => void; onSkip?: (rule: MobileRecurringRule) => void; onEdit: (rule: MobileRecurringRule) => void; onToggle: (rule: MobileRecurringRule) => void; onDelete: (rule: MobileRecurringRule) => void }) {
  const styles = useStyles(); const ui = useUiStyles();
  if (!rules.length) return null;
  return <View style={styles.section}><SectionTitle>{title}</SectionTitle>{rules.map((rule) => {
    const account = accounts.find((item) => item.id === rule.accountId); const category = categories.find((item) => item.id === rule.categoryId);
    return <Card key={rule.id}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${rule.label ?? 'recurring rule'}`} onPress={() => onEdit(rule)}>{({ pressed }) => <View style={pressed ? styles.pressed : undefined}><View style={styles.ruleTop}><View style={styles.ruleCopy}><Text style={ui.listTitle}>{rule.label ?? category?.name ?? 'Recurring transaction'}</Text><Text style={ui.listMeta}>{account?.label ?? 'Unknown account'} {'·'} {rule.frequency} {'·'} Due {rule.nextDueDate}</Text></View>{due ? <Badge>Due</Badge> : !rule.isActive ? <Badge variant="muted">Inactive</Badge> : null}</View><Text style={[styles.amount, rule.type === 'income' ? styles.income : styles.expense]}>{rule.type === 'income' ? '+' : '−'}{sourceMoney(rule.amount, account?.currency ?? 'PHP')}</Text></View>}</Pressable><View style={styles.actions}>{due ? <><Button size="compact" variant="outline" onPress={() => onSkip?.(rule)}>Skip</Button><Button size="compact" onPress={() => onApprove?.(rule)}>Approve</Button></> : null}<Button size="compact" variant="outline" onPress={() => onToggle(rule)}>{rule.isActive ? 'Deactivate' : 'Reactivate'}</Button><Button size="compact" variant="destructive" onPress={() => onDelete(rule)}>Delete</Button></View></Card>;
  })}</View>;
}

function RuleEditor({ accounts, categories, exists, rule, onCancel, onChange, onDelete, onSave }: { accounts: MobileAccount[]; categories: MobileCategory[]; exists: boolean; rule: MobileRecurringRule | null; onCancel: () => void; onChange: (rule: MobileRecurringRule) => void; onDelete: (rule: MobileRecurringRule) => void; onSave: () => void }) {
  const styles = useStyles(); const matchingCategories = rule ? categories.filter((category) => category.type === rule.type) : [];
  return <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="formSheet" visible={Boolean(rule)}><Screen scrollable>{rule ? <View style={styles.form}><View style={styles.editorHeader}><Title>{exists ? 'Edit recurring rule' : 'New recurring rule'}</Title><Text style={styles.subtitle}>Choose when this income or expense should be ready for review.</Text></View><Field label="Label (optional)" placeholder="e.g. Rent" value={rule.label ?? ''} onChangeText={(label) => onChange({ ...rule, label: label || null })} /><Field label={`Amount (${accounts.find((account) => account.id === rule.accountId)?.currency ?? 'PHP'})`} keyboardType="decimal-pad" value={rule.amount} onChangeText={(amount) => onChange({ ...rule, amount })} /><Field label="Next due date (YYYY-MM-DD)" value={rule.nextDueDate} onChangeText={(nextDueDate) => onChange({ ...rule, nextDueDate })} /><Text style={styles.fieldLabel}>Account</Text><View style={styles.chips}>{accounts.map((account) => <ChoiceChip key={account.id} label={account.label} selected={rule.accountId === account.id} onPress={() => onChange({ ...rule, accountId: account.id })} />)}</View><Text style={styles.fieldLabel}>Type</Text><View style={styles.chips}>{(['income', 'expense'] as const).map((type) => <ChoiceChip key={type} label={type} selected={rule.type === type} onPress={() => onChange({ ...rule, type, categoryId: rule.categoryId && categories.find((category) => category.id === rule.categoryId)?.type === type ? rule.categoryId : null })} />)}</View><Text style={styles.fieldLabel}>Frequency</Text><View style={styles.chips}>{(['weekly', 'monthly', 'yearly'] as const).map((frequency) => <ChoiceChip key={frequency} label={frequency} selected={rule.frequency === frequency} onPress={() => onChange({ ...rule, frequency })} />)}</View>{matchingCategories.length ? <><Text style={styles.fieldLabel}>Category (optional)</Text><View style={styles.chips}>{matchingCategories.map((category) => <ChoiceChip key={category.id} label={category.name} selected={rule.categoryId === category.id} onPress={() => onChange({ ...rule, categoryId: rule.categoryId === category.id ? null : category.id })} />)}</View></> : null}<View style={styles.editorActions}><Button size="full" onPress={onSave}>{exists ? 'Save changes' : 'Create recurring rule'}</Button>{exists ? <Button variant="outline" onPress={() => onDelete(rule)}>Delete rule</Button> : null}<Button variant="outline" onPress={onCancel}>Cancel</Button></View></View> : null}</Screen></Modal>;
}

function useStyles() { const { theme } = useAppTheme(); return useMemo(() => StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 18 }, heading: { flex: 1, gap: 2 }, subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 }, content: { gap: 18, paddingBottom: 28 }, section: { gap: 8 }, ruleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, ruleCopy: { flex: 1, gap: 2 }, amount: { marginTop: 12, fontFamily: fontFamily.display, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] }, income: { color: theme.income }, expense: { color: theme.expense }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }, pressed: { opacity: 0.75 }, form: { gap: 16, paddingBottom: 30 }, editorHeader: { gap: 4, marginBottom: 6 }, fieldLabel: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500', marginBottom: -8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, editorActions: { gap: 10, marginTop: 8 } }), [theme]); }

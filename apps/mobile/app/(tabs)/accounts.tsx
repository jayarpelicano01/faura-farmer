import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAccount } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import { currentBalance } from '@/data/current-balance';
import { Badge, Button, Card, ChoiceChip, Empty, Field, Screen, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useCurrency } from '@/ui/currency';
import { useSync } from '@/sync/use-sync';
import { useLocalSearchParams, useRouter } from 'expo-router';

const accountTypes: MobileAccount['type'][] = ['bank', 'e_wallet', 'cash', 'credit_card', 'investment'];
const typeLabels: Record<MobileAccount['type'], string> = {
  bank: 'Bank',
  e_wallet: 'E-wallet',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

function blankAccount(): MobileAccount {
  return { id: Crypto.randomUUID(), label: '', type: 'bank', institution: null, currency: 'PHP', startingBalance: '0', color: null, icon: null, isArchived: false, updatedAt: new Date().toISOString() };
}

export default function AccountsScreen() {
  const router = useRouter();
  const { new: createNew } = useLocalSearchParams<{ new?: string | string[] }>();
  const { theme } = useAppTheme();
  const styles = useAccountsStyles();
  const ui = useUiStyles();
  const { db } = useWorkspace();
  const { convert, displayCurrency, formatMoney: formatDisplayMoney } = useCurrency();
  const { accounts, debtCashEvents, loading, reload, transactions } = useWorkspaceData();
  const [editing, setEditing] = useState<MobileAccount | null>(null);
  const [editingCurrentBalance, setEditingCurrentBalance] = useState('');
  const handledCreateParam = useRef(false);
  const { syncNow } = useSync();
  const loaded = !loading;

  useEffect(() => {
    const shouldCreate = (Array.isArray(createNew) ? createNew[0] : createNew) === '1';
    if (!shouldCreate) {
      handledCreateParam.current = false;
      return;
    }
    if (!loaded || handledCreateParam.current) return;
    handledCreateParam.current = true;
    const account = blankAccount();
    setEditing(account);
    setEditingCurrentBalance(account.startingBalance);
    router.setParams({ new: undefined });
  }, [createNew, loaded, router]);

  const save = async () => {
    if (!editing?.label.trim() || !/^\d+(\.\d{1,2})?$/.test(editing.startingBalance)) {
      Alert.alert('Check this account', 'A name and a valid starting balance are required.');
      return;
    }
    const updatedAccount = { ...editing, label: editing.label.trim(), startingBalance: convert(editing.startingBalance, displayCurrency, editing.currency), updatedAt: new Date().toISOString() };
    const targetBalance = Number(convert(editingCurrentBalance, displayCurrency, editing.currency));
    if (accounts.some((account) => account.id === editing.id) && (!/^-?\d+(\.\d{1,2})?$/.test(editingCurrentBalance) || !Number.isFinite(targetBalance))) {
      Alert.alert('Check this account', 'Enter a valid current balance.');
      return;
    }
    await db.queueUpsert('account', updatedAccount);
    if (accounts.some((account) => account.id === editing.id)) {
      const difference = Math.round((targetBalance - currentBalance(updatedAccount, transactions, debtCashEvents)) * 100) / 100;
      if (Math.abs(difference) >= 0.005) {
        await db.queueUpsert('transaction', {
          id: Crypto.randomUUID(),
          accountId: updatedAccount.id,
          categoryId: null,
          bucket: null,
          amount: Math.abs(difference).toFixed(2),
          type: difference > 0 ? 'income' : 'expense',
          destinationAccountId: null,
          date: new Date().toISOString().slice(0, 10),
          note: 'Balance adjustment',
          updatedAt: new Date().toISOString(),
        });
      }
    }
    setEditing(null);
    await reload();
    void syncNow();
  };

  const remove = (id: string) => Alert.alert('Delete account?', 'Transactions in this account will also be removed when synchronized.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void db.queueDelete('account', id).then(reload).then(() => syncNow()); } },
  ]);

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Title>Accounts</Title>
          <Text style={styles.subtitle}>Your cash, cards, banks, and wallets.</Text>
        </View>
        <Button
          accessibilityLabel="Create a new account"
          onPress={() => { const account = blankAccount(); setEditing(account); setEditingCurrentBalance(account.startingBalance); }}
          size="compact"
        >New</Button>
      </View>
      <ScrollView contentContainerStyle={styles.listContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {accounts.length === 0 ? <Empty>Add your first account to start tracking.</Empty> : accounts.map((account) => (
          <Pressable
            key={account.id}
            accessibilityHint="Double tap to edit. Press and hold to delete."
            accessibilityLabel={`${account.label}, ${typeLabels[account.type]}, ${formatDisplayMoney(String(currentBalance(account, transactions, debtCashEvents)), account.currency)}`}
            accessibilityRole="button"
            onLongPress={() => remove(account.id)}
            onPress={() => { setEditing({ ...account, startingBalance: convert(account.startingBalance, account.currency) }); setEditingCurrentBalance(convert(String(currentBalance(account, transactions, debtCashEvents)), account.currency)); }}
          >
            {({ pressed }) => (
              <View style={pressed ? styles.pressed : undefined}>
                <Card>
                  <View style={styles.accountTop}>
                    <View style={styles.accountIdentity}>
                      <View style={[styles.identityMark, { backgroundColor: account.color ?? theme.primary }]}>
                        <Text style={styles.identityText}>{account.label.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.accountCopy}>
                        <Text numberOfLines={1} style={ui.listTitle}>{account.label}</Text>
                        <Text numberOfLines={1} style={ui.listMeta}>{typeLabels[account.type]}</Text>
                      </View>
                    </View>
                    {account.isArchived ? <Badge variant="muted">Archived</Badge> : null}
                  </View>
                  <Text style={styles.balance}>{formatDisplayMoney(String(currentBalance(account, transactions, debtCashEvents)), account.currency)}</Text>
                  <Text style={styles.balanceMeta}>Starting {formatDisplayMoney(account.startingBalance, account.currency)}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.editHint}>Tap to edit</Text>
                    <Text style={styles.deleteHint}>Hold to delete</Text>
                  </View>
                </Card>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <Button variant="outline" onPress={() => router.replace('/(tabs)/dashboard')}>Done</Button>

      <AccountEditor account={editing} currentBalance={editingCurrentBalance} displayCurrency={displayCurrency} exists={accounts.some((account) => account.id === editing?.id)} onChange={setEditing} onCurrentBalanceChange={setEditingCurrentBalance} onCancel={() => setEditing(null)} onSave={() => void save()} />
    </Screen>
  );
}

function AccountEditor({ account, currentBalance, displayCurrency, exists, onChange, onCurrentBalanceChange, onCancel, onSave }: { account: MobileAccount | null; currentBalance: string; displayCurrency: string; exists: boolean; onChange: (account: MobileAccount) => void; onCurrentBalanceChange: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  const styles = useAccountsStyles();
  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="formSheet" visible={Boolean(account)}>
      <Screen scrollable>
        <View style={styles.editorHeader}>
          <Title>{exists ? 'Edit account' : 'New account'}</Title>
          <Text style={styles.subtitle}>Keep your starting balance and account details up to date.</Text>
        </View>
        {account ? <View style={styles.form}>
          <Field label="Name" placeholder="e.g. GCash or Cash wallet" value={account.label} onChangeText={(label) => onChange({ ...account, label })} />
          <Field label={`Starting balance (${displayCurrency})`} keyboardType="decimal-pad" value={account.startingBalance} onChangeText={(startingBalance) => {
            const previous = Number(account.startingBalance);
            const next = Number(startingBalance);
            if (Number.isFinite(previous) && Number.isFinite(next) && Number.isFinite(Number(currentBalance))) {
              onCurrentBalanceChange((Number(currentBalance) + next - previous).toFixed(2));
            }
            onChange({ ...account, startingBalance });
          }} />
          {exists ? <Field label={`Current balance (${displayCurrency})`} keyboardType="decimal-pad" value={currentBalance} onChangeText={onCurrentBalanceChange} /> : null}
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.chips}>{(['PHP', 'USD'] as const).map((currency) => <ChoiceChip key={currency} label={currency} selected={account.currency === currency} onPress={() => onChange({ ...account, currency })} />)}</View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Account type</Text>
            <View style={styles.chips}>{accountTypes.map((type) => <ChoiceChip key={type} label={typeLabels[type]} selected={account.type === type} onPress={() => onChange({ ...account, type })} />)}</View>
          </View>
          <View style={styles.formActions}>
            <Button size="full" onPress={onSave}>{exists ? 'Save changes' : 'Add account'}</Button>
            <Button variant="outline" onPress={onCancel}>Cancel</Button>
          </View>
        </View> : null}
      </Screen>
    </Modal>
  );
}

function useAccountsStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 20 },
  headingCopy: { flex: 1, minWidth: 0 },
  subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  listContent: { flexGrow: 1, paddingBottom: 32 },
  accountTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  accountIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  identityMark: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 20 },
  identityText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 15, fontWeight: '700' },
  accountCopy: { flex: 1, minWidth: 0, gap: 2 },
  balance: { marginTop: 20, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 20, fontWeight: '600', letterSpacing: -0.7, lineHeight: 28, fontVariant: ['tabular-nums'] },
  balanceMeta: { marginTop: 2, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 17, borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  editHint: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  deleteHint: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 13 },
  editorHeader: { marginBottom: 24 },
  form: { gap: 0 },
  formSection: { marginBottom: 16 },
   fieldLabel: { marginBottom: 8, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  formActions: { gap: 12, marginTop: 8 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  }), [theme]);
}

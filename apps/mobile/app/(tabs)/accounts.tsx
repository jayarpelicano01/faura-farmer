import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAccount } from '@faura-farmer/types';
import { listRecords, queueDelete, queueUpsert } from '@/data/db';
import { Badge, Button, Card, ChoiceChip, Empty, Field, Screen, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { useRouter } from 'expo-router';

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

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function AccountsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useAccountsStyles();
  const ui = useUiStyles();
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [editing, setEditing] = useState<MobileAccount | null>(null);
  const { syncNow } = useSync();
  const load = useCallback(async () => setAccounts(await listRecords('account')), []);
  useEffect(() => { void load(); }, [load, editing]);

  const save = async () => {
    if (!editing?.label.trim() || !/^\d+(\.\d{1,2})?$/.test(editing.startingBalance)) {
      Alert.alert('Check this account', 'A name and a valid starting balance are required.');
      return;
    }
    await queueUpsert('account', { ...editing, label: editing.label.trim(), updatedAt: new Date().toISOString() });
    setEditing(null);
    await load();
    void syncNow();
  };

  const remove = (id: string) => Alert.alert('Delete account?', 'Transactions in this account will also be removed when synchronized.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void queueDelete('account', id).then(load).then(() => syncNow()); } },
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
          onPress={() => setEditing(blankAccount())}
          size="compact"
        >New</Button>
      </View>
      <ScrollView contentContainerStyle={styles.listContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {accounts.length === 0 ? <Empty>Add your first account to start tracking.</Empty> : accounts.map((account) => (
          <Pressable
            key={account.id}
            accessibilityHint="Double tap to edit. Press and hold to delete."
            accessibilityLabel={`${account.label}, ${typeLabels[account.type]}, ${formatMoney(account.startingBalance, account.currency)}`}
            accessibilityRole="button"
            onLongPress={() => remove(account.id)}
            onPress={() => setEditing(account)}
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
                        <Text numberOfLines={1} style={ui.listMeta}>{typeLabels[account.type]}{account.institution ? ` · ${account.institution}` : ''}</Text>
                      </View>
                    </View>
                    {account.isArchived ? <Badge variant="muted">Archived</Badge> : null}
                  </View>
                  <Text style={styles.balance}>{formatMoney(account.startingBalance, account.currency)}</Text>
                  <Text style={styles.balanceMeta}>Starting balance</Text>
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

      <AccountEditor account={editing} exists={accounts.some((account) => account.id === editing?.id)} onChange={setEditing} onCancel={() => setEditing(null)} onSave={() => void save()} />
    </Screen>
  );
}

function AccountEditor({ account, exists, onChange, onCancel, onSave }: { account: MobileAccount | null; exists: boolean; onChange: (account: MobileAccount) => void; onCancel: () => void; onSave: () => void }) {
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
          <Field label="Starting balance" keyboardType="decimal-pad" value={account.startingBalance} onChangeText={(startingBalance) => onChange({ ...account, startingBalance })} />
          <Field label="Currency" autoCapitalize="characters" value={account.currency} onChangeText={(currency) => onChange({ ...account, currency })} />
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

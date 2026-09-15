import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { calculateDebtState, debtCashDirection, type MobileDebt, type MobileDebtAdjustment, type MobileDebtCashEvent, type MobileDebtPayment, type MobilePerson } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import { Badge, Button, Card, ChoiceChip, Empty, Field, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useCurrency } from '@/ui/currency';
import { useSync } from '@/sync/use-sync';

type FormKind = 'person' | 'debt' | 'payment' | 'adjustment' | null;
type DraftDebt = { personId: string; direction: 'receivable' | 'payable'; originalPrincipal: string; currency: 'PHP' | 'USD'; openedAt: string; dueDate: string; note: string; openingAccountId: string };

function today() { return new Date().toISOString().slice(0, 10); }
function blankDebt(personId = ''): DraftDebt { return { personId, direction: 'receivable', originalPrincipal: '', currency: 'PHP', openedAt: today(), dueDate: '', note: '', openingAccountId: '' }; }

export default function DebtsScreen() {
  const router = useRouter();
  const { new: createNew } = useLocalSearchParams<{ new?: string | string[] }>();
  const { theme } = useAppTheme();
  const styles = useDebtStyles();
  const ui = useUiStyles();
  const { activeWorkspace, db } = useWorkspace();
  const { accounts, debtAdjustments, debtCashEvents, debtPayments, debts, people, reload } = useWorkspaceData();
  const { formatMoney } = useCurrency();
  const { syncNow } = useSync();
  const [form, setForm] = useState<FormKind>(null);
  const [selectedDebt, setSelectedDebt] = useState<MobileDebt | null>(null);
  const [personName, setPersonName] = useState('');
  const [personContact, setPersonContact] = useState('');
  const [personNote, setPersonNote] = useState('');
  const [debtDraft, setDebtDraft] = useState<DraftDebt>(() => blankDebt());
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [reason, setReason] = useState('correction');
  const [otherReason, setOtherReason] = useState('');
  const [pending, setPending] = useState(0);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  useEffect(() => {
    if ((Array.isArray(createNew) ? createNew[0] : createNew) !== '1') return;
    setDebtDraft(blankDebt(people[0]?.id ?? ''));
    setForm('debt');
    router.setParams({ new: undefined });
  }, [createNew, people, router]);
  useEffect(() => { void db.getPendingSyncCount().then(setPending).catch(() => setPending(0)); }, [db, debts, debtAdjustments, debtCashEvents, debtPayments, people]);

  async function done() { await reload(); if (activeWorkspace === 'online') void syncNow(); }
  async function savePerson() {
    if (!personName.trim()) return Alert.alert('Display name required', 'Enter a name for this person.');
    const record: MobilePerson = { id: Crypto.randomUUID(), displayName: personName.trim(), contact: personContact.trim() || null, note: personNote.trim() || null, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('person', record); else await db.upsertLocal('person', record);
    setDebtDraft((current) => ({ ...current, personId: record.id }));
    setPersonName(''); setPersonContact(''); setPersonNote(''); setForm('debt'); await done();
  }
  async function saveDebt() {
    if (!debtDraft.personId || !/^\d+(\.\d{1,2})?$/.test(debtDraft.originalPrincipal) || Number(debtDraft.originalPrincipal) <= 0) return Alert.alert('Check this debt', 'Choose a person and enter a positive principal with up to two decimal places.');
    const record: MobileDebt = { id: Crypto.randomUUID(), personId: debtDraft.personId, direction: debtDraft.direction, originalPrincipal: debtDraft.originalPrincipal, currency: debtDraft.currency, status: 'open', openedAt: debtDraft.openedAt, dueDate: debtDraft.dueDate || null, note: debtDraft.note.trim() || null, isHidden: false, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt', record); else await db.upsertLocal('debt', record);
    if (debtDraft.openingAccountId) {
      const event: MobileDebtCashEvent = { id: Crypto.randomUUID(), debtId: record.id, paymentId: null, accountId: debtDraft.openingAccountId, amount: record.originalPrincipal, direction: debtCashDirection(record.direction, 'opening'), date: record.openedAt, updatedAt: new Date().toISOString() };
      if (activeWorkspace === 'online') await db.queueUpsert('debt_cash_event', event); else await db.upsertLocal('debt_cash_event', event);
    }
    setForm(null); await done();
  }
  async function savePayment() {
    if (!selectedDebt || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return Alert.alert('Check this payment', 'Enter a positive payment with up to two decimal places.');
    const state = debtState(selectedDebt, debtAdjustments, debtPayments);
    if (Number(amount) > Number(state.outstandingBalance)) return Alert.alert('Payment is too large', 'A payment cannot exceed the outstanding balance.');
    const payment: MobileDebtPayment = { id: Crypto.randomUUID(), debtId: selectedDebt.id, amount, date, note: note.trim() || null, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt_payment', payment); else await db.upsertLocal('debt_payment', payment);
    if (accountId) {
      const event: MobileDebtCashEvent = { id: Crypto.randomUUID(), debtId: selectedDebt.id, paymentId: payment.id, accountId, amount, direction: debtCashDirection(selectedDebt.direction, 'payment'), date, updatedAt: new Date().toISOString() };
      if (activeWorkspace === 'online') await db.queueUpsert('debt_cash_event', event); else await db.upsertLocal('debt_cash_event', event);
    }
    const nextStatus = calculateDebtState({ originalPrincipal: selectedDebt.originalPrincipal, adjustments: debtAdjustments.filter((item) => item.debtId === selectedDebt.id).map((item) => ({ amount: item.amount })), payments: [...debtPayments.filter((item) => item.debtId === selectedDebt.id), payment].map((item) => ({ amount: item.amount })) }).status;
    const updated = { ...selectedDebt, status: nextStatus, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt', updated); else await db.upsertLocal('debt', updated);
    closeEntry(); await done();
  }
  async function saveAdjustment() {
    if (!selectedDebt || !/^-?\d+(\.\d{1,2})?$/.test(amount) || Number(amount) === 0) return Alert.alert('Check this adjustment', 'Enter a non-zero amount with up to two decimal places.');
    if (reason === 'other' && !otherReason.trim()) return Alert.alert('Describe the adjustment', 'Add a reason for this adjustment.');
    const state = debtState(selectedDebt, debtAdjustments, debtPayments);
    if (Number(state.outstandingBalance) + Number(amount) < 0) return Alert.alert('Adjustment is too large', 'An adjustment cannot reduce the outstanding balance below zero.');
    const adjustment: MobileDebtAdjustment = { id: Crypto.randomUUID(), debtId: selectedDebt.id, amount, reason: reason === 'other' ? `other: ${otherReason.trim()}` : reason, date, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt_adjustment', adjustment); else await db.upsertLocal('debt_adjustment', adjustment);
    const nextStatus = calculateDebtState({ originalPrincipal: selectedDebt.originalPrincipal, adjustments: [...debtAdjustments.filter((item) => item.debtId === selectedDebt.id), adjustment].map((item) => ({ amount: item.amount })), payments: debtPayments.filter((item) => item.debtId === selectedDebt.id).map((item) => ({ amount: item.amount })) }).status;
    const updated = { ...selectedDebt, status: nextStatus, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt', updated); else await db.upsertLocal('debt', updated);
    closeEntry(); await done();
  }
  function closeEntry() { setAmount(''); setDate(today()); setNote(''); setAccountId(''); setReason('correction'); setOtherReason(''); setSelectedDebt(null); setForm(null); }
  async function changeStatus(debt: MobileDebt, status: MobileDebt['status']) { const next = { ...debt, status, isHidden: status === 'open' ? false : debt.isHidden, updatedAt: new Date().toISOString() }; if (activeWorkspace === 'online') await db.queueUpsert('debt', next); else await db.upsertLocal('debt', next); await done(); }
  async function changeVisibility(debt: MobileDebt, isHidden: boolean) {
    if (debt.status !== 'paid' && debt.status !== 'written_off') return Alert.alert('Close this debt first', 'Only paid or written-off debts can be hidden or unhidden.');
    const next = { ...debt, isHidden, updatedAt: new Date().toISOString() };
    if (activeWorkspace === 'online') await db.queueUpsert('debt', next); else await db.upsertLocal('debt', next);
    await done();
  }
  async function deletePerson(person: MobilePerson) {
    if (debts.some((debt) => debt.personId === person.id)) return;
    if (activeWorkspace === 'online') await db.queueDelete('person', person.id); else await db.deleteLocal('person', person.id);
    await done();
  }

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const groups = useMemo(() => {
    const result = new Map<string, MobileDebt[]>();
    for (const debt of debts.filter((debt) => !debt.isHidden)) { const name = peopleById.get(debt.personId)?.displayName ?? 'Unknown person'; result.set(name, [...(result.get(name) ?? []), debt]); }
    return [...result.entries()];
  }, [debts, peopleById]);
  const hiddenDebts = useMemo(() => debts.filter((debt) => debt.isHidden), [debts]);
  const renderDebt = (debt: MobileDebt) => {
    const state = debtState(debt, debtAdjustments, debtPayments);
    const active = debt.status === 'open' || debt.status === 'partially_paid';
    return <Card key={debt.id}>
      <View style={styles.row}><View style={styles.copy}><Text style={ui.listTitle}>{debt.direction === 'receivable' ? 'They owe you' : 'You owe them'}</Text><Text style={ui.listMeta}>Opened {debt.openedAt}{debt.dueDate ? ` · Due ${debt.dueDate}` : ''}</Text></View><Text style={[styles.amount, debt.direction === 'receivable' ? styles.income : styles.expense]}>{formatMoney(state.outstandingBalance, debt.currency)}</Text></View>
      <View style={styles.meta}><Badge variant="muted">{debt.status.replace('_', ' ')}</Badge><Text style={ui.listMeta}>Principal {formatMoney(debt.originalPrincipal, debt.currency)}</Text></View>
      {debt.note ? <Text style={ui.listMeta}>{debt.note}</Text> : null}
      <View style={styles.actions}>{active ? <><Button size="compact" variant="outline" onPress={() => { setSelectedDebt(debt); setForm('payment'); }}>Payment</Button><Button size="compact" variant="outline" onPress={() => { setSelectedDebt(debt); setForm('adjustment'); }}>Adjust</Button><Button size="compact" variant="outline" onPress={() => void changeStatus(debt, 'written_off')}>Write off</Button></> : <><Button size="compact" variant="outline" onPress={() => void changeStatus(debt, 'open')}>Reopen</Button><Button size="compact" variant="outline" onPress={() => void changeVisibility(debt, !debt.isHidden)}>{debt.isHidden ? 'Unhide' : 'Hide'}</Button></>}</View>
    </Card>;
  };

  return <Screen scrollable><View style={styles.header}><View><Title>Debts</Title><Text style={styles.subtitle}>What you owe and what people owe you.</Text></View><Button size="compact" onPress={() => { setDebtDraft(blankDebt(people[0]?.id ?? '')); setForm('debt'); }}>New</Button></View>{pending > 0 && activeWorkspace === 'online' ? <Badge variant="outline">Pending sync</Badge> : null}
    {debts.length === 0 ? <Empty>Create your first debt to keep your full financial picture in one place.</Empty> : groups.map(([name, group]) => <View key={name} style={styles.group}><SectionTitle>{name}</SectionTitle>{group.map((debt) => { const state = debtState(debt, debtAdjustments, debtPayments); const active = debt.status === 'open' || debt.status === 'partially_paid'; return <Card key={debt.id}><View style={styles.row}><View style={styles.copy}><Text style={ui.listTitle}>{debt.direction === 'receivable' ? 'They owe you' : 'You owe them'}</Text><Text style={ui.listMeta}>Opened {debt.openedAt}{debt.dueDate ? ` · Due ${debt.dueDate}` : ''}</Text></View><Text style={[styles.amount, debt.direction === 'receivable' ? styles.income : styles.expense]}>{formatMoney(state.outstandingBalance, debt.currency)}</Text></View><View style={styles.meta}><Badge variant="muted">{debt.status.replace('_', ' ')}</Badge><Text style={ui.listMeta}>Principal {formatMoney(debt.originalPrincipal, debt.currency)}</Text></View>{debt.note ? <Text style={ui.listMeta}>{debt.note}</Text> : null}<View style={styles.actions}>{active ? <><Button size="compact" variant="outline" onPress={() => { setSelectedDebt(debt); setForm('payment'); }}>Payment</Button><Button size="compact" variant="outline" onPress={() => { setSelectedDebt(debt); setForm('adjustment'); }}>Adjust</Button><Button size="compact" variant="outline" onPress={() => void changeStatus(debt, 'written_off')}>Write off</Button></> : <Button size="compact" variant="outline" onPress={() => void changeStatus(debt, 'open')}>Reopen</Button>}</View></Card>; })}</View>)}
    <View style={styles.group}><SectionTitle>People</SectionTitle><Button size="compact" variant="outline" onPress={() => setForm('person')}>Add person</Button>{people.length === 0 ? <Text style={ui.listMeta}>Add a person before creating a debt.</Text> : people.map((person) => <Text key={person.id} style={ui.listTitle}>{person.displayName}</Text>)}</View>
    <DebtModal open={form === 'person'} title="New person" onClose={() => setForm(null)}><Field label="Display name" value={personName} onChangeText={setPersonName} /><Field label="Contact (optional)" value={personContact} onChangeText={setPersonContact} /><Field label="Note (optional)" value={personNote} onChangeText={setPersonNote} /><Button onPress={() => void savePerson()}>Save person</Button></DebtModal>
    <DebtModal open={form === 'debt'} title="New debt" onClose={() => setForm(null)}><Text style={styles.fieldLabel}>Person</Text><View style={styles.chips}>{people.map((person) => <ChoiceChip key={person.id} label={person.displayName} selected={debtDraft.personId === person.id} onPress={() => setDebtDraft({ ...debtDraft, personId: person.id })} />)}</View>{people.length === 0 ? <Button variant="outline" onPress={() => setForm('person')}>Create new person</Button> : null}<Text style={styles.fieldLabel}>Direction</Text><View style={styles.chips}><ChoiceChip label="They owe you" selected={debtDraft.direction === 'receivable'} onPress={() => setDebtDraft({ ...debtDraft, direction: 'receivable' })} /><ChoiceChip label="You owe them" selected={debtDraft.direction === 'payable'} onPress={() => setDebtDraft({ ...debtDraft, direction: 'payable' })} /></View><Text style={styles.fieldLabel}>Currency</Text><View style={styles.chips}><ChoiceChip label="PHP" selected={debtDraft.currency === 'PHP'} onPress={() => setDebtDraft({ ...debtDraft, currency: 'PHP', openingAccountId: '' })} /><ChoiceChip label="USD" selected={debtDraft.currency === 'USD'} onPress={() => setDebtDraft({ ...debtDraft, currency: 'USD', openingAccountId: '' })} /></View><Field label="Original principal" keyboardType="decimal-pad" value={debtDraft.originalPrincipal} onChangeText={(value) => setDebtDraft({ ...debtDraft, originalPrincipal: value })} /><Field label="Opened (YYYY-MM-DD)" value={debtDraft.openedAt} onChangeText={(value) => setDebtDraft({ ...debtDraft, openedAt: value })} /><Field label="Due date (optional)" value={debtDraft.dueDate} onChangeText={(value) => setDebtDraft({ ...debtDraft, dueDate: value })} /><Field label="Note (optional)" value={debtDraft.note} onChangeText={(value) => setDebtDraft({ ...debtDraft, note: value })} /><Text style={styles.fieldLabel}>Opening cash account (optional)</Text><View style={styles.chips}><ChoiceChip label="No tracked cash movement" selected={!debtDraft.openingAccountId} onPress={() => setDebtDraft({ ...debtDraft, openingAccountId: '' })} />{accounts.filter((account) => account.currency === debtDraft.currency).map((account) => <ChoiceChip key={account.id} label={account.label} selected={debtDraft.openingAccountId === account.id} onPress={() => setDebtDraft({ ...debtDraft, openingAccountId: account.id })} />)}</View><Button onPress={() => void saveDebt()}>Create debt</Button></DebtModal>
    <DebtModal open={form === 'payment'} title="Record payment" onClose={closeEntry}><Field label="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /><Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Field label="Note (optional)" value={note} onChangeText={setNote} /><Text style={styles.fieldLabel}>Cash account (optional)</Text><View style={styles.chips}><ChoiceChip label="Settled outside accounts" selected={!accountId} onPress={() => setAccountId('')} />{accounts.filter((account) => account.currency === selectedDebt?.currency).map((account) => <ChoiceChip key={account.id} label={account.label} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />)}</View><Button onPress={() => void savePayment()}>Save payment</Button></DebtModal>
    <DebtModal open={form === 'adjustment'} title="Record adjustment" onClose={closeEntry}><Field label="Amount (negative reduces principal)" keyboardType="numbers-and-punctuation" value={amount} onChangeText={setAmount} /><Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Text style={styles.fieldLabel}>Reason</Text><View style={styles.chips}>{[['correction', 'Correction'], ['agreed_reduction', 'Agreed reduction'], ['partial_forgiveness', 'Partial forgiveness'], ['other', 'Other']].map(([value, label]) => <ChoiceChip key={value} label={label} selected={reason === value} onPress={() => setReason(value)} />)}</View>{reason === 'other' ? <Field label="Describe the reason" value={otherReason} onChangeText={setOtherReason} /> : null}<Button onPress={() => void saveAdjustment()}>Save adjustment</Button></DebtModal>
  </Screen>;
}

function debtState(debt: MobileDebt, adjustments: MobileDebtAdjustment[], payments: MobileDebtPayment[]) { return calculateDebtState({ originalPrincipal: debt.originalPrincipal, adjustments: adjustments.filter((item) => item.debtId === debt.id).map((item) => ({ amount: item.amount })), payments: payments.filter((item) => item.debtId === debt.id).map((item) => ({ amount: item.amount })), status: debt.status }); }
function DebtModal({ children, onClose, open, title }: { children: React.ReactNode; onClose: () => void; open: boolean; title: string }) { const { theme } = useAppTheme(); const styles = useDebtStyles(); return <Modal animationType="slide" onRequestClose={onClose} visible={open}><Screen scrollable><View style={styles.modalHeader}><Title>{title}</Title><Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose}><Text style={{ color: theme.primary, fontFamily: fontFamily.body, fontWeight: '700' }}>Close</Text></Pressable></View><View style={styles.form}>{children}</View></Screen></Modal>; }
function useDebtStyles() { const { theme } = useAppTheme(); return useMemo(() => StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }, subtitle: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 }, group: { gap: 10, marginTop: 20 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, copy: { flex: 1, minWidth: 0, gap: 2 }, amount: { fontFamily: fontFamily.display, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }, income: { color: theme.income }, expense: { color: theme.expense }, meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 }, form: { gap: 16, paddingBottom: 36 }, fieldLabel: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600', marginBottom: -8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -8 } }), [theme]); }

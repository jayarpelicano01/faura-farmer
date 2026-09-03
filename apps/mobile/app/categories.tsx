import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import type { MobileCategory } from '@faura-farmer/types';
import { listRecords, queueDelete, queueUpsert } from '@/data/db';
import { BodyText, Button, Card, ChoiceChip, Empty, Field, Screen, SectionTitle, Title, ui } from '@/ui/primitives';
import { fontFamily, theme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';

function blankCategory(type: MobileCategory['type'] = 'expense'): MobileCategory {
  return { id: Crypto.randomUUID(), name: '', type, parentId: null, icon: null, color: null, bucket: null, updatedAt: new Date().toISOString() };
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [editing, setEditing] = useState<MobileCategory | null>(null);
  const router = useRouter();
  const { syncNow } = useSync();
  const load = useCallback(async () => setCategories(await listRecords('category')), []);
  useEffect(() => { void load(); }, [load, editing]);

  const incomeCategories = useMemo(() => categories.filter((category) => category.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => categories.filter((category) => category.type === 'expense'), [categories]);

  const save = async () => {
    if (!editing?.name.trim()) {
      Alert.alert('Enter a category name');
      return;
    }
    await queueUpsert('category', { ...editing, name: editing.name.trim(), updatedAt: new Date().toISOString() });
    setEditing(null);
    await load();
    void syncNow();
  };

  const remove = (id: string) => Alert.alert(
    'Delete category?',
    'Existing transactions will become uncategorized after sync.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setEditing(null);
          void queueDelete('category', id).then(load).then(() => syncNow());
        },
      },
    ],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Title>Categories</Title>
          <BodyText muted>Organize income and expenses.</BodyText>
        </View>
        <Pressable
          accessibilityLabel="Add expense category"
          accessibilityRole="button"
          onPress={() => setEditing(blankCategory())}
          style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CategoryColumn
          categories={incomeCategories}
          onAdd={() => setEditing(blankCategory('income'))}
          onDelete={remove}
          onEdit={setEditing}
          title="Income"
          type="income"
        />
        <CategoryColumn
          categories={expenseCategories}
          onAdd={() => setEditing(blankCategory('expense'))}
          onDelete={remove}
          onEdit={setEditing}
          title="Expenses"
          type="expense"
        />
        <Text style={styles.hint}>Tap a category to edit it, or hold it to delete it.</Text>
      </ScrollView>

      <Button tone="plain" onPress={() => router.back()}>Done</Button>
      <CategoryEditor
        category={editing}
        exists={categories.some((category) => category.id === editing?.id)}
        onCancel={() => setEditing(null)}
        onChange={setEditing}
        onDelete={remove}
        onSave={() => void save()}
      />
    </Screen>
  );
}

function CategoryColumn({
  categories,
  onAdd,
  onDelete,
  onEdit,
  title,
  type,
}: {
  categories: MobileCategory[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (category: MobileCategory) => void;
  title: string;
  type: MobileCategory['type'];
}) {
  const fallbackColor = type === 'income' ? theme.income : theme.expense;

  return (
    <Card>
      <View style={styles.cardHeader}>
        <SectionTitle>{title}</SectionTitle>
        <Pressable accessibilityLabel={`Add ${title.toLowerCase()} category`} accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.outlineButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.outlineButtonText}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.categoryList}>
        {categories.length === 0 ? (
          <Empty>No {title.toLowerCase()} categories yet.</Empty>
        ) : categories.map((category) => (
          <Pressable
            key={category.id}
            accessibilityHint="Hold to delete this category"
            accessibilityRole="button"
            onLongPress={() => onDelete(category.id)}
            onPress={() => onEdit(category)}
            style={({ pressed }) => [styles.categoryRow, pressed ? styles.rowPressed : undefined]}
          >
            <View style={[styles.categoryDot, { backgroundColor: category.color || fallbackColor }]} />
            <View style={styles.categoryCopy}>
              <Text numberOfLines={1} style={ui.listTitle}>{category.name}</Text>
              <Text style={ui.listMeta}>{type === 'income' ? 'Income category' : 'Expense category'}</Text>
            </View>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function CategoryEditor({
  category,
  exists,
  onCancel,
  onChange,
  onDelete,
  onSave,
}: {
  category: MobileCategory | null;
  exists: boolean;
  onCancel: () => void;
  onChange: (category: MobileCategory) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} visible={Boolean(category)}>
      <Screen scrollable>
        <View style={styles.editorShell}>
          <View style={styles.editorHeader}>
            <View style={styles.heading}>
              <Title>{exists ? 'Edit category' : 'New category'}</Title>
              <BodyText muted>{exists ? 'Update how this category appears in your records.' : 'Create a category for your transactions.'}</BodyText>
            </View>
            <Pressable accessibilityLabel="Close category editor" accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : undefined]}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          {category ? (
            <Card>
              <Field label="Name" placeholder="Category name" value={category.name} onChangeText={(name) => onChange({ ...category, name })} />
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chips}>
                {(['income', 'expense'] as const).map((type) => (
                  <ChoiceChip key={type} label={type === 'income' ? 'Income' : 'Expense'} selected={category.type === type} onPress={() => onChange({ ...category, type })} />
                ))}
              </View>
              <View style={styles.editorActions}>
                <Button onPress={onSave}>{exists ? 'Save changes' : 'Add category'}</Button>
                <Button tone="plain" onPress={onCancel}>Cancel</Button>
                {exists ? <Button tone="danger" onPress={() => onDelete(category.id)}>Delete category</Button> : null}
              </View>
            </Card>
          ) : null}
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingBottom: 16 },
  heading: { flex: 1, gap: 0 },
  addButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 8, backgroundColor: theme.primarySolid, paddingHorizontal: 16 },
  addButtonText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  content: { gap: 4, paddingBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 },
  outlineButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 7, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 12 },
  outlineButtonText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  categoryList: { gap: 8 },
  categoryRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderCurve: 'continuous', borderRadius: 8, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 10 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryCopy: { flex: 1, gap: 2 },
  editText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  hint: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, paddingHorizontal: 4, textAlign: 'center' },
  editorShell: { flexGrow: 1, gap: 18 },
  editorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  closeButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  closeButtonText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  fieldLabel: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editorActions: { gap: 10, marginTop: 20 },
  pressed: { opacity: 0.82 },
  rowPressed: { backgroundColor: theme.muted, opacity: 0.9 },
});

import { createContext, useContext, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, radius, theme } from './theme';

const AppChromeContext = createContext(false);

export function AppChromeProvider({ children }: PropsWithChildren) {
  return <AppChromeContext.Provider value>{children}</AppChromeContext.Provider>;
}

type ScreenProps = PropsWithChildren<{ scrollable?: boolean }>;

export function Screen({ children, scrollable = false }: ScreenProps) {
  const insideAppChrome = useContext(AppChromeContext);
  const edges = insideAppChrome ? ['left', 'right', 'bottom'] as const : ['top', 'left', 'right'] as const;
  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );

  return <SafeAreaView edges={edges} style={styles.screen}>{content}</SafeAreaView>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function BodyText({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted ? styles.muted : undefined]}>{children}</Text>;
}

export function InlineNotice({ children, tone = 'error' }: PropsWithChildren<{ tone?: 'error' | 'info' }>) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, tone === 'error' ? styles.errorNotice : styles.infoNotice]}>
      <Text style={[styles.noticeText, tone === 'error' ? styles.errorText : styles.infoText]}>{children}</Text>
    </View>
  );
}

export function Button({ children, onPress, tone = 'primary', disabled = false }: PropsWithChildren<{ onPress: () => void; tone?: 'primary' | 'danger' | 'plain' | 'outline'; disabled?: boolean }>) {
  const buttonStyle = tone === 'danger'
    ? styles.dangerButton
    : tone === 'plain'
      ? styles.plainButton
      : tone === 'outline'
        ? styles.outlineButton
        : styles.primaryButton;
  const textStyle = tone === 'plain' || tone === 'outline' ? styles.plainButtonText : styles.buttonText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, buttonStyle, disabled ? styles.disabledButton : undefined, pressed && !disabled ? styles.pressedButton : undefined]}
    >
      <Text style={textStyle}>{children}</Text>
    </Pressable>
  );
}

export function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.chipSelected : undefined, pressed ? styles.chipPressed : undefined]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.mutedForeground}
        selectionColor={theme.primary}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Empty({ children }: PropsWithChildren) {
  return <View style={styles.emptySurface}><Text style={styles.empty}>{children}</Text></View>;
}

export const ui = StyleSheet.create({
  heading: { color: theme.foreground, fontFamily: fontFamily.display, fontWeight: '600' },
  body: { color: theme.foreground, fontFamily: fontFamily.body },
  muted: { color: theme.mutedForeground, fontFamily: fontFamily.body },
  action: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600' },
  listTitle: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600' },
  listMeta: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  screenContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  card: {
    marginBottom: 12,
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: theme.card,
    padding: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
  },
  title: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: 23, fontWeight: '600', letterSpacing: -1.1, lineHeight: 31 },
  sectionTitle: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: 15, fontWeight: '600', letterSpacing: -0.5, lineHeight: 22 },
  body: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
  muted: { color: theme.mutedForeground },
  notice: { marginBottom: 16, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10 },
  errorNotice: { backgroundColor: theme.accent, borderColor: theme.expense, borderWidth: StyleSheet.hairlineWidth },
  infoNotice: { backgroundColor: theme.accent },
  noticeText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  errorText: { color: theme.accentForeground },
  infoText: { color: theme.accentForeground },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 16, paddingVertical: 12 },
  primaryButton: { backgroundColor: theme.primarySolid },
  dangerButton: { backgroundColor: theme.danger },
  plainButton: { backgroundColor: theme.muted },
  outlineButton: { borderColor: theme.input, borderWidth: 1, backgroundColor: theme.card },
  disabledButton: { opacity: 0.5 },
  pressedButton: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  buttonText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600' },
  plainButtonText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600' },
  field: { marginBottom: 16 },
  label: { marginBottom: 7, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 46, borderCurve: 'continuous', borderWidth: 1, borderColor: theme.input, borderRadius: radius.control, backgroundColor: theme.background, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10 },
  emptySurface: { marginBottom: 12, borderCurve: 'continuous', borderRadius: radius.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.card },
  empty: { paddingHorizontal: 18, paddingVertical: 28, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  chip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8, borderCurve: 'continuous', borderRadius: radius.control, borderColor: theme.input, borderWidth: 1, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { borderColor: theme.primarySolid, backgroundColor: theme.primarySolid },
  chipPressed: { opacity: 0.86 },
  chipText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: theme.primaryForeground },
});

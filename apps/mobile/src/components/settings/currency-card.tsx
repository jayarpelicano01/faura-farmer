import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, DropdownSelect, InlineNotice, SectionTitle, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

type CurrencyCardProps = {
  activeWorkspace: 'local' | 'online';
  changeDisplayCurrency: (value: 'PHP' | 'USD') => Promise<void>;
  currencyError: string | null;
  currencySuccess: string | null;
  displayCurrency: 'PHP' | 'USD';
  rateDate: string | null;
  rateRefreshedAt: string | null;
  refreshRate: () => Promise<void>;
  savingCurrency: boolean;
  usdPerPhp: string | null;
};

export function CurrencyCard(props: CurrencyCardProps) {
  const ui = useUiStyles();
  const styles = useStyles();
  const rateCopy = props.usdPerPhp
    ? `1 PHP = ${props.usdPerPhp} USD${props.rateDate ? ` · Rate date ${props.rateDate}` : ''}${props.rateRefreshedAt ? ` · refreshed ${new Date(props.rateRefreshedAt).toLocaleString()}` : ''}`
    : 'No USD rate is cached on this device.';
  return <Card><SectionTitle>Display currency</SectionTitle><View style={styles.content}>
    <Text style={ui.listMeta}>Show amounts in PHP or USD. Your saved balances and transaction history stay unchanged.</Text>
    <DropdownSelect label="Currency" options={[{ label: 'PHP - Philippine Peso', value: 'PHP' }, { label: 'USD - US Dollar', value: 'USD' }]} value={props.displayCurrency} onValueChange={(next) => void props.changeDisplayCurrency(next as 'PHP' | 'USD')} disabled={props.savingCurrency} />
    <Text style={styles.hint}>{rateCopy}</Text>
    {props.currencyError ? <InlineNotice>{props.currencyError}</InlineNotice> : null}
    {props.currencySuccess ? <InlineNotice tone="info">{props.currencySuccess}</InlineNotice> : null}
    {props.activeWorkspace === 'online' ? <Button disabled={props.savingCurrency} size="compact" variant="outline" onPress={() => void props.refreshRate()}>{props.savingCurrency ? 'Refreshing rate…' : 'Refresh rate'}</Button> : null}
  </View></Card>;
}

function useStyles() { const { theme } = useAppTheme(); return StyleSheet.create({ content: { gap: 12, marginTop: 16 }, hint: { marginTop: -8, marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 } }); }

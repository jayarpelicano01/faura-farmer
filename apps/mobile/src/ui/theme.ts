// Mirrors the web app's default `.dark` CSS variables in React Native colors.
export const theme = {
  background: '#141A1F',
  foreground: '#E0F2F0',
  card: '#1F2832',
  surface: '#1F2832',
  muted: '#262F3A',
  mutedForeground: '#91AAB2',
  border: '#2B3846',
  input: '#344653',
  primary: '#339DF6',
  primarySolid: '#030B26',
  primaryForeground: '#FFFFFF',
  accent: '#093A52',
  accentForeground: '#D0E8FC',
  income: '#22C18C',
  expense: '#3876A0',
  danger: '#256A93',
  overlay: 'rgba(3, 11, 38, 0.72)',
  shadow: '#030B26',
} as const;

export const fontFamily = {
  body: 'AlbertSans',
  display: 'Unbounded',
} as const;

export const radius = {
  card: 12,
  control: 8,
  small: 6,
} as const;

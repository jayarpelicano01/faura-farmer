import type { Config } from 'tailwindcss';
import { colors, fontFamily } from './tokens';

const config: Config = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      colors,
      fontFamily,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
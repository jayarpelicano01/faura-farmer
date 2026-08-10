import sharedConfig from '@faura-farmer/config/tailwind';
import type { Config } from 'tailwindcss';

const semanticColors = {
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  income: {
    DEFAULT: 'hsl(var(--income))',
    soft: 'hsl(var(--income) / 0.12)',
  },
  expense: {
    DEFAULT: 'hsl(var(--expense))',
    soft: 'hsl(var(--expense) / 0.12)',
  },
} as const;

const config: Config = {
  ...sharedConfig,
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/config/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      ...sharedConfig.theme?.extend,
      colors: {
        ...sharedConfig.theme?.extend?.colors,
        ...semanticColors,
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
};

export default config;
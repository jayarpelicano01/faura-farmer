import type { Metadata } from 'next';
import { Albert_Sans, Unbounded } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';

const unbounded = Unbounded({
  variable: '--font-unbounded',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const albertSans = Albert_Sans({
  variable: '--font-albert-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'Faura-Farmer',
    template: '%s · Faura-Farmer',
  },
  description: 'A personal finance tracker: accounts, transactions, categories and reports.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${unbounded.variable} ${albertSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          richColors={false}
          toastOptions={{
            classNames: {
              toast:
                'group border-border bg-card text-card-foreground shadow-lg',
              title: 'font-medium text-foreground',
              description: 'text-sm text-muted-foreground',
              success: 'border-income/40',
              error: 'border-expense/40',
            },
          }}
        />
      </body>
    </html>
  );
}
import type { Metadata } from 'next';
import { Albert_Sans, Unbounded } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/providers/session-provider';

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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${unbounded.variable} ${albertSans.variable}`}
    >
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
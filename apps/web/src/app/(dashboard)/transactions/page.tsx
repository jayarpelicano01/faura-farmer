import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@faura-farmer/database';
import { TransactionsManager } from '@/components/transactions/transactions-manager';
import type { AccountCurrency } from '@faura-farmer/types';

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: { label: 'asc' },
    }),
    prisma.category.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <TransactionsManager
      accounts={accounts.map((a) => ({ ...a, startingBalance: String(a.startingBalance), currency: a.currency as AccountCurrency }))}
      categories={categories}
    />
  );
}
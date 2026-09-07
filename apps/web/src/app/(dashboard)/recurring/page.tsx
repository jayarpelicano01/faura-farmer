import { prisma } from '@faura-farmer/database';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RecurringManager } from '@/components/recurring/recurring-manager';
import type { AccountCurrency } from '@faura-farmer/types';

export default async function RecurringPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId: session.user.id }, orderBy: { label: 'asc' } }),
    prisma.category.findMany({ where: { userId: session.user.id }, orderBy: { name: 'asc' } }),
  ]);
  return <RecurringManager accounts={accounts.map((account) => ({ ...account, startingBalance: String(account.startingBalance), currency: account.currency as AccountCurrency }))} categories={categories} />;
}

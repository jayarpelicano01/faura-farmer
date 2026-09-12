import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAccountsWithBalance } from '@/lib/queries';
import { DebtManager } from '@/components/debts/debt-manager';

export default async function DebtsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const accounts = await getAccountsWithBalance(session.user.id);
  return <DebtManager accounts={accounts.map(({ id, label, currency }) => ({ id, label, currency }))} />;
}

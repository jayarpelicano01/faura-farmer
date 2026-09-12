import { auth } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/http';
import { listDebtCashEventReconciliationIssues } from '@/lib/services/debt-ledger';

/** Operator-visible validation before a debt migration or release is approved. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const issues = await listDebtCashEventReconciliationIssues(session.user.id);
  return ok({ valid: issues.length === 0, issues });
}

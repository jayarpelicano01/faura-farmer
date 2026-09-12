import { auth } from '@/lib/auth';
import { badRequest, created, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { createDebtSchema } from '@/lib/validations';
import { createDebt, DebtLedgerError, listDebts, serializeDebt } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return ok((await listDebts(session.user.id)).map(serializeDebt));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'debt-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createDebtSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid debt');
  try {
    const debt = await createDebt(session.user.id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'debt', debt.id);
    for (const event of debt.cashEvents) await recordCanonicalMobileUpsert(session.user.id, 'debt_cash_event', event.id);
    return created(serializeDebt(debt));
  } catch (error) {
    if (error instanceof DebtLedgerError) return fail(error.message, error.status, error.code);
    throw error;
  }
}

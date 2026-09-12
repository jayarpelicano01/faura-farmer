import { auth } from '@/lib/auth';
import { badRequest, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { createDebtPaymentSchema } from '@/lib/validations';
import { createDebtPayment, DebtLedgerError, serializeDebt } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'debt-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createDebtPaymentSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid payment');
  try {
    const debt = await createDebtPayment(session.user.id, id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'debt', debt.id);
    for (const payment of debt.payments) await recordCanonicalMobileUpsert(session.user.id, 'debt_payment', payment.id);
    for (const event of debt.cashEvents) await recordCanonicalMobileUpsert(session.user.id, 'debt_cash_event', event.id);
    return ok(serializeDebt(debt));
  } catch (error) {
    if (error instanceof DebtLedgerError) return fail(error.message, error.status, error.code);
    throw error;
  }
}

import { auth } from '@/lib/auth';
import { badRequest, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { createDebtAdjustmentSchema } from '@/lib/validations';
import { createDebtAdjustment, DebtLedgerError, serializeDebt } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'debt-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createDebtAdjustmentSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid adjustment');
  try {
    const debt = await createDebtAdjustment(session.user.id, id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'debt', debt.id);
    for (const adjustment of debt.adjustments) await recordCanonicalMobileUpsert(session.user.id, 'debt_adjustment', adjustment.id);
    return ok(serializeDebt(debt));
  } catch (error) {
    if (error instanceof DebtLedgerError) return fail(error.message, error.status, error.code);
    throw error;
  }
}

import { auth } from '@/lib/auth';
import { badRequest, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { debtStatusActionSchema } from '@/lib/validations';
import { changeDebtStatus, DebtLedgerError, serializeDebt } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'debt-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = debtStatusActionSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid debt status action');
  try {
    const debt = await changeDebtStatus(session.user.id, id, parsed.data.action);
    await recordCanonicalMobileUpsert(session.user.id, 'debt', debt.id);
    return ok(serializeDebt(debt));
  } catch (error) {
    if (error instanceof DebtLedgerError) return fail(error.message, error.status, error.code);
    throw error;
  }
}

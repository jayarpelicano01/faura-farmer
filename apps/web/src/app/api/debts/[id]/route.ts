import { auth } from '@/lib/auth';
import { badRequest, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { updateDebtSchema } from '@/lib/validations';
import { DebtLedgerError, getDebt, serializeDebt, updateDebt } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

function debtError(error: unknown) {
  return error instanceof DebtLedgerError ? fail(error.message, error.status, error.code) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  try {
    return ok(serializeDebt(await getDebt(session.user.id, id)));
  } catch (error) {
    const response = debtError(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'debt-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateDebtSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid debt update');
  try {
    const debt = await updateDebt(session.user.id, id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'debt', debt.id);
    return ok(serializeDebt(debt));
  } catch (error) {
    const response = debtError(error);
    if (response) return response;
    throw error;
  }
}

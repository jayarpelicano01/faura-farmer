import { auth } from '@/lib/auth';
import { badRequest, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { updatePersonSchema } from '@/lib/validations';
import { DebtLedgerError, deletePerson, updatePerson } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileTombstone, recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

function debtError(error: unknown) {
  return error instanceof DebtLedgerError ? fail(error.message, error.status, error.code) : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'person-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updatePersonSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid person');
  try {
    const person = await updatePerson(session.user.id, id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'person', person.id);
    return ok(person);
  } catch (error) {
    const response = debtError(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'person-write', session.user.id);
  if (securityFailure) return securityFailure;
  try {
    await deletePerson(session.user.id, id);
    await recordCanonicalMobileTombstone(session.user.id, 'person', id);
    return ok({ id, deleted: true });
  } catch (error) {
    const response = debtError(error);
    if (response) return response;
    throw error;
  }
}

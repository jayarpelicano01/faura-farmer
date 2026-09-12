import { auth } from '@/lib/auth';
import { badRequest, created, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { createPersonSchema } from '@/lib/validations';
import { createPerson, DebtLedgerError, listPersons } from '@/lib/services/debt-ledger';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return ok(await listPersons(session.user.id));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'person-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createPersonSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid person');
  try {
    const person = await createPerson(session.user.id, parsed.data);
    await recordCanonicalMobileUpsert(session.user.id, 'person', person.id);
    return created(person);
  } catch (error) {
    if (error instanceof DebtLedgerError) return fail(error.message, error.status, error.code);
    throw error;
  }
}

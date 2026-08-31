import { auth } from '@/lib/auth';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recurringOccurrenceSchema } from '@/lib/validations';
import { approveRecurringOccurrence } from '@/lib/services/recurring-transactions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'recurring-rule-approve', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = recurringOccurrenceSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Expected due date is required');
  const result = await approveRecurringOccurrence(session.user.id, id, parsed.data.expectedDueDate);
  if (result.status === 'not_found') return notFound('Recurring rule not found');
  if (result.status === 'invalid_rule') return badRequest('Recurring rule has invalid account or category ownership');
  if (result.status !== 'approved') {
    return fail('This occurrence has changed or is not due', 409, 'RECURRING_OCCURRENCE_CONFLICT');
  }
  return ok({ transactionId: result.transactionId, nextDueDate: result.nextDueDate });
}

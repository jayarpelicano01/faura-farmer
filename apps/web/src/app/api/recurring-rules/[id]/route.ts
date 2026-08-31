import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { updateRecurringRuleSchema } from '@/lib/validations';
import { serializeRecurringRule, updateRecurringRule } from '@/lib/services/recurring-transactions';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const rule = await prisma.recurringRule.findFirst({
    where: { id, userId: session.user.id },
    include: { account: true, category: true },
  });
  if (!rule) return notFound('Recurring rule not found');
  return ok(serializeRecurringRule(rule));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'recurring-rule-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateRecurringRuleSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid recurring rule');

  const result = await updateRecurringRule(session.user.id, id, parsed.data);
  if (result.status === 'not_found') return notFound('Recurring rule not found');
  if (result.status === 'account_not_found') return fail('Account not found', 404, 'NOT_FOUND');
  if (result.status === 'category_not_found') return fail('Category not found', 404, 'NOT_FOUND');
  if (result.status === 'category_type_mismatch') {
    return badRequest('Category type must match the recurring transaction type');
  }
  return ok(result.rule);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'recurring-rule-write', session.user.id);
  if (securityFailure) return securityFailure;
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: session.user.id } });
  if (!rule) return notFound('Recurring rule not found');
  await prisma.recurringRule.delete({ where: { id: rule.id } });
  return ok({ id: rule.id, deleted: true });
}

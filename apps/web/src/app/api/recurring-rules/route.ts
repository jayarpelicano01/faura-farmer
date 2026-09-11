import { auth } from '@/lib/auth';
import { badRequest, created, fail, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { createRecurringRuleSchema } from '@/lib/validations';
import { createRecurringRule, listRecurringRules } from '@/lib/services/recurring-transactions';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return ok(await listRecurringRules(session.user.id));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'recurring-rule-write', session.user.id);
  if (securityFailure) return securityFailure;
  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createRecurringRuleSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid recurring rule');

  const result = await createRecurringRule(session.user.id, parsed.data);
  if (result.status === 'account_not_found') return fail('Account not found', 404, 'NOT_FOUND');
  if (result.status === 'category_not_found') return fail('Category not found', 404, 'NOT_FOUND');
  if (result.status === 'category_type_mismatch') {
    return badRequest('Category type must match the recurring transaction type');
  }
  await recordCanonicalMobileUpsert(session.user.id, 'recurring_rule', result.rule.id);
  return created(result.rule);
}

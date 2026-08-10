import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { createAccountSchema } from '@/lib/validations';
import { badRequest, created, ok, unauthorized } from '@/lib/http';
import { getAccountsWithBalance } from '@/lib/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const accounts = await getAccountsWithBalance(session.user.id);
  return ok(accounts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const account = await prisma.account.create({
    data: {
      userId: session.user.id,
      label: parsed.data.label,
      type: parsed.data.type,
      institution: parsed.data.institution ?? null,
      currency: parsed.data.currency ?? 'PHP',
      startingBalance: parsed.data.startingBalance,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
    },
  });

  return created({ ...account, balance: String(account.startingBalance) });
}
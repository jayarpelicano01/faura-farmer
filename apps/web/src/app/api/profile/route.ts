import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const data: { name?: string | null; username?: string | null } = {};
  if ('name' in parsed.data) data.name = parsed.data.name?.trim() || null;
  if ('username' in parsed.data) {
    const username = parsed.data.username?.trim().toLowerCase();
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== session.user.id) {
        return badRequest('That username is already taken');
      }
      data.username = username;
    } else {
      data.username = null;
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, email: true, name: true, username: true, authProvider: true },
  });

  return ok({ user });
}
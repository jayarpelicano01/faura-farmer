import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) {
    return badRequest('Password change is not available for this account');
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return ok({ message: 'Password updated' });
}
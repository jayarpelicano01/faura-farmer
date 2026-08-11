import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { registerSchema } from '@/lib/validations';
import { badRequest } from '@/lib/http';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return badRequest('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      authProvider: 'email',
      name: parsed.data.name?.trim() || null,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return Response.json({ user }, { status: 201 });
}
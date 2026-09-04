import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { createCategorySchema } from '@/lib/validations';
import { badRequest, created, ok, unauthorized } from '@/lib/http';
import { getCategoryTree } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const tree = await getCategoryTree(session.user.id);
  return ok(tree);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'category-write', session.user.id);
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createCategorySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  if (parsed.data.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: parsed.data.parentId, userId: session.user.id },
      select: { id: true, type: true },
    });
    if (!parent) return badRequest('Parent category not found');
    if (parsed.data.type !== parent.type) {
      return badRequest('Child category must match parent type');
    }
  }

  const category = await prisma.category.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      parentId: parsed.data.parentId ?? null,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      bucket: parsed.data.bucket ?? null,
    },
  });

  await recordCanonicalMobileUpsert(session.user.id, 'category', category.id);

  return created(category);
}

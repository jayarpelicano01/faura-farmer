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
  if (
    typeof bodyResult.data === 'object'
    && bodyResult.data !== null
    && 'parentId' in bodyResult.data
    && bodyResult.data.parentId !== null
    && bodyResult.data.parentId !== undefined
  ) {
    return badRequest('Categories cannot have a parent');
  }
  const parsed = createCategorySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const category = await prisma.category.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      bucket: parsed.data.bucket ?? null,
    },
  });

  await recordCanonicalMobileUpsert(session.user.id, 'category', category.id);

  return created(category);
}

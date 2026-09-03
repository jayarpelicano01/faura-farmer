import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateCategorySchema } from '@/lib/validations';
import { badRequest, notFound, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileTombstone, recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  return ok(category);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'category-write', session.user.id);
  if (securityFailure) return securityFailure;

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateCategorySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  if (parsed.data.parentId && parsed.data.parentId !== category.id) {
    const parent = await prisma.category.findFirst({
      where: { id: parsed.data.parentId, userId: session.user.id },
      select: { id: true, type: true },
    });
    if (!parent) return badRequest('Parent category not found');
    const effectiveType = parsed.data.type ?? category.type;
    if (effectiveType !== parent.type) {
      return badRequest('Child category must match parent type');
    }
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: parsed.data,
  });

  await recordCanonicalMobileUpsert(session.user.id, 'category', updated.id);

  return ok(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'category-write', session.user.id);
  if (securityFailure) return securityFailure;

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  // Prisma's SetNull relations are correct for the browser, but mobile peers
  // also need canonical upserts for the affected children and transactions.
  const [children, transactions] = await prisma.$transaction([
    prisma.category.findMany({ where: { userId: session.user.id, parentId: category.id }, select: { id: true } }),
    prisma.transaction.findMany({ where: { userId: session.user.id, categoryId: category.id }, select: { id: true } }),
  ]);

  await prisma.category.delete({ where: { id: category.id } });
  for (const child of children) {
    await recordCanonicalMobileUpsert(session.user.id, 'category', child.id);
  }
  for (const transaction of transactions) {
    await recordCanonicalMobileUpsert(session.user.id, 'transaction', transaction.id);
  }
  await recordCanonicalMobileTombstone(session.user.id, 'category', category.id);

  return ok({ id: category.id, deleted: true });
}

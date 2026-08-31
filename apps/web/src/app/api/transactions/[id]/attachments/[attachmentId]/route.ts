import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { fail, notFound, ok, serviceUnavailable, unauthorized } from '@/lib/http';
import { guardMutation } from '@/lib/security';
import { deleteReceiptObjects, ReceiptStorageError } from '@/lib/storage/receipts';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'transaction-receipt-delete', session.user.id);
  if (securityFailure) return securityFailure;
  const attachment = await prisma.transactionAttachment.findFirst({
    where: { id: attachmentId, transactionId: id, userId: session.user.id },
  });
  if (!attachment) return notFound('Receipt attachment not found');
  try {
    await deleteReceiptObjects([attachment.storagePath]);
    await prisma.transactionAttachment.delete({ where: { id: attachment.id } });
    return ok({ id: attachment.id, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt removal failed';
    if (error instanceof ReceiptStorageError && error.unavailable) return serviceUnavailable(message);
    return fail(message, 502, 'RECEIPT_STORAGE_ERROR');
  }
}

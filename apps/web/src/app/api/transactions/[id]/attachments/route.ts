import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { badRequest, created, fail, notFound, ok, payloadTooLarge, serviceUnavailable, unauthorized } from '@/lib/http';
import { guardMutation } from '@/lib/security';
import {
  createReceiptSignedUrl,
  deleteReceiptObjects,
  MAX_RECEIPT_FILE_BYTES,
  MAX_RECEIPTS_PER_TRANSACTION,
  newReceiptStoragePath,
  ReceiptStorageError,
  uploadReceiptObject,
  validateReceiptFile,
} from '@/lib/storage/receipts';

export const runtime = 'nodejs';

const MAX_MULTIPART_BYTES = MAX_RECEIPT_FILE_BYTES * MAX_RECEIPTS_PER_TRANSACTION + 1024 * 1024;

async function ownedTransaction(id: string, userId: string) {
  return prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } });
}

async function serializeAttachment(attachment: {
  id: string;
  transactionId: string;
  userId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...attachment,
    signedUrl: await createReceiptSignedUrl(attachment.storagePath),
  };
}

function storageFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Receipt storage request failed';
  if (error instanceof ReceiptStorageError && error.unavailable) return serviceUnavailable(message);
  return fail(message, 502, 'RECEIPT_STORAGE_ERROR');
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  if (!(await ownedTransaction(id, session.user.id))) return notFound('Transaction not found');
  try {
    const attachments = await prisma.transactionAttachment.findMany({
      where: { transactionId: id, userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    });
    return ok({ items: await Promise.all(attachments.map(serializeAttachment)) });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'transaction-receipt-upload', session.user.id);
  if (securityFailure) return securityFailure;
  if (!(await ownedTransaction(id, session.user.id))) return notFound('Transaction not found');
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return payloadTooLarge('Receipt upload request is too large');
  }

  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((entry): entry is File => typeof entry !== 'string');
    if (files.length === 0) return badRequest('Choose at least one receipt image');
    if (files.length !== form.getAll('files').length) return badRequest('Receipt upload is malformed');
    const existingCount = await prisma.transactionAttachment.count({
      where: { transactionId: id, userId: session.user.id },
    });
    if (existingCount + files.length > MAX_RECEIPTS_PER_TRANSACTION) {
      return badRequest(`A transaction can have at most ${MAX_RECEIPTS_PER_TRANSACTION} receipt images`);
    }
    let validated: Awaited<ReturnType<typeof validateReceiptFile>>[];
    try {
      validated = await Promise.all(files.map(validateReceiptFile));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Receipt validation failed';
      return message.includes('10 MB') ? payloadTooLarge(message) : badRequest(message);
    }
    const uploaded: string[] = [];
    const metadata = validated.map((file) => ({
      ...file,
      storagePath: newReceiptStoragePath(session.user.id, id, file.mimeType),
    }));
    let metadataSaved = false;
    try {
      for (let index = 0; index < files.length; index += 1) {
        await uploadReceiptObject(metadata[index]!.storagePath, files[index]!, metadata[index]!.mimeType);
        uploaded.push(metadata[index]!.storagePath);
      }
      const attachments = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"::text AS "id"
          FROM "transactions"
          WHERE "id" = CAST(${id} AS UUID) AND "user_id" = CAST(${session.user.id} AS UUID)
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new ReceiptTransactionNotFoundError();
        const count = await tx.transactionAttachment.count({
          where: { transactionId: id, userId: session.user.id },
        });
        if (count + metadata.length > MAX_RECEIPTS_PER_TRANSACTION) {
          throw new ReceiptLimitError();
        }
        return Promise.all(
          metadata.map((file) =>
            tx.transactionAttachment.create({
              data: {
                transactionId: id,
                userId: session.user.id,
                storagePath: file.storagePath,
                originalFilename: file.originalFilename,
                mimeType: file.mimeType,
                fileSize: file.fileSize,
              },
            }),
          ),
        );
      });
      metadataSaved = true;
      return created({ items: await Promise.all(attachments.map(serializeAttachment)) });
    } catch (error) {
      if (!metadataSaved && uploaded.length > 0) {
        await deleteReceiptObjects(uploaded).catch(() => undefined);
      }
      if (error instanceof ReceiptTransactionNotFoundError) return notFound('Transaction not found');
      if (error instanceof ReceiptLimitError) {
        return badRequest(`A transaction can have at most ${MAX_RECEIPTS_PER_TRANSACTION} receipt images`);
      }
      throw error;
    }
  } catch (error) {
    return storageFailure(error);
  }
}

class ReceiptTransactionNotFoundError extends Error {}
class ReceiptLimitError extends Error {}

import { auth } from '@/lib/auth';
import { BackupRestoreError, importBackupForUser, previewBackupForUser } from '@/lib/backup/financial';
import { BackupValidationError, MAX_BACKUP_FILE_BYTES } from '@/lib/backup/validation';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { badRequest, ok, payloadTooLarge, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';

type ImportRequest = { action?: unknown; file?: unknown };

async function authenticatedUser(request: Request) {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, isMobile: false } as const;
  const mobileUser = await authenticateMobileRequest(request);
  if (!mobileUser) return null;
  return { userId: mobileUser.id, isMobile: true } as const;
}

export async function POST(request: Request) {
  const identity = await authenticatedUser(request);
  if (!identity) return unauthorized();

  if (!identity.isMobile) {
    const securityFailure = await guardMutation(request, 'financial-backup-import', identity.userId);
    if (securityFailure) return securityFailure;
  }

  const body = await readJsonBody<ImportRequest>(request, MAX_BACKUP_FILE_BYTES + 64 * 1024);
  if ('response' in body) return body.response;
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return badRequest('Provide a backup file and import action');
  }
  const { action, file } = body.data;
  if ((action !== 'preview' && action !== 'confirm') || typeof file !== 'string') {
    return badRequest('Provide a backup file and import action');
  }
  if (new TextEncoder().encode(file).byteLength > MAX_BACKUP_FILE_BYTES) {
    return payloadTooLarge('Backup files are limited to 5 MB');
  }

  try {
    if (action === 'preview') {
      return ok(await previewBackupForUser(identity.userId, file));
    }
    return ok(await importBackupForUser(identity.userId, file));
  } catch (error) {
    if (error instanceof BackupValidationError || error instanceof BackupRestoreError) return badRequest(error.message);
    console.error('Backup import failed', { error: error instanceof Error ? error.message : 'unknown' });
    return badRequest('Unable to restore this backup');
  }
}

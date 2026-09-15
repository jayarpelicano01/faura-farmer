import { auth } from '@/lib/auth';
import { unauthorized } from '@/lib/http';
import { exportBackupForUser } from '@/lib/backup/financial';

const WARNING_SIZE_BYTES = 5 * 1024 * 1024;

function backupFileName() {
  return `faura-farmer-backup-${new Date().toISOString().slice(0, 10)}.faura-backup.json`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  try {
    const backup = await exportBackupForUser(session.user.id);
    return new Response(backup.json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${backupFileName()}"`,
        'Cache-Control': 'private, no-store',
        ...(backup.bytes > WARNING_SIZE_BYTES ? { 'X-Faura-Backup-Warning': 'Backup exceeds 5 MB' } : {}),
      },
    });
  } catch (error) {
    console.error('Backup export failed', { error: error instanceof Error ? error.message : 'unknown' });
    return new Response(JSON.stringify({ error: 'Unable to export backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

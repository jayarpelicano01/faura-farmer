import { auth } from '@/lib/auth';
import { badRequest, ok, payloadTooLarge, unauthorized } from '@/lib/http';
import {
  confirmCsvImport,
  CsvImportError,
  MAX_CSV_FILE_BYTES,
  previewCsvImport,
  type CsvMappings,
} from '@/lib/csv/transactions';
import { guardMutation } from '@/lib/security';

const MAX_MULTIPART_BYTES = MAX_CSV_FILE_BYTES + 1024 * 1024;

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new CsvImportError('Import options are malformed');
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'transaction-csv-import', session.user.id);
  if (securityFailure) return securityFailure;
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return payloadTooLarge('CSV import request is too large');
  }

  try {
    const form = await request.formData();
    const action = form.get('action');
    const file = form.get('file');
    if ((action !== 'preview' && action !== 'confirm') || !file || typeof file === 'string') {
      return badRequest('Provide a CSV file and an import action');
    }
    if (file.size > MAX_CSV_FILE_BYTES) return payloadTooLarge('CSV files are limited to 10 MB');
    if (file.type && !['text/csv', 'application/csv', 'text/plain'].includes(file.type)) {
      return badRequest('Upload a CSV file');
    }
    const text = await file.text();
    const mappings = parseJson<CsvMappings>(form.get('mappings'), {});
    if (action === 'preview') return ok(await previewCsvImport(session.user.id, text, mappings));
    const excludedRows = parseJson<unknown>(form.get('excludedRows'), []);
    if (!Array.isArray(excludedRows) || excludedRows.some((row) => !Number.isInteger(row) || row < 2)) {
      return badRequest('Excluded rows are malformed');
    }
    return ok(await confirmCsvImport(session.user.id, text, mappings, excludedRows));
  } catch (error) {
    if (error instanceof CsvImportError) {
      return error.status === 413 ? payloadTooLarge(error.message) : badRequest(error.message);
    }
    console.error('CSV import failed', { error: error instanceof Error ? error.message : 'unknown' });
    return badRequest('Unable to import CSV');
  }
}

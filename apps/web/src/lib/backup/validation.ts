import {
  backupEntityCounts,
  BackupFormatError,
  MAX_BACKUP_FILE_BYTES,
  parseBackupDocumentText,
  type BackupDocument,
  type BackupEntityCounts,
} from '@faura-farmer/types';

export { MAX_BACKUP_FILE_BYTES };

export class BackupValidationError extends Error {}

export type BackupPreview = {
  document: BackupDocument;
  entityCounts: BackupEntityCounts;
};

/** Parses and validates a portable backup at the server boundary. */
export function validateBackupFile(file: string): BackupPreview {
  try {
    const document = parseBackupDocumentText(file);
    return { document, entityCounts: backupEntityCounts(document) };
  } catch (error) {
    if (error instanceof BackupFormatError) throw new BackupValidationError(error.message);
    throw error;
  }
}

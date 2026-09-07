import { NextResponse } from 'next/server';

type SyncOperation = 'pull' | 'push';
type SyncStage = 'availability' | 'authentication' | 'validation' | 'change_feed' | 'rate_limit' | 'mutation';

function requestIdFor() {
  return crypto.randomUUID();
}

function errorCodeFor(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'UNKNOWN';
}

/**
 * Converts unexpected mobile-sync failures into a safe, traceable API response.
 * The server log intentionally excludes request bodies and authorization headers.
 */
export function mobileSyncFailure(operation: SyncOperation, stage: SyncStage, error: unknown) {
  const requestId = requestIdFor();
  console.error('Mobile sync failed', {
    requestId,
    operation,
    stage,
    errorCode: errorCodeFor(error),
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });

  return NextResponse.json(
    {
      error: 'Mobile sync is temporarily unavailable. Please try again.',
      code: operation === 'pull' ? 'SYNC_PULL_FAILED' : 'SYNC_PUSH_FAILED',
      requestId,
    },
    { status: 500 },
  );
}

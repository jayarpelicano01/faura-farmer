'use client';

import { ErrorCard } from '@/components/ui/error-card';

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <ErrorCard reset={reset} className="w-full max-w-md" />
    </div>
  );
}
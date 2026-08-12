'use client';

import { ErrorCard } from '@/components/ui/error-card';

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="py-10">
      <ErrorCard reset={reset} />
    </div>
  );
}
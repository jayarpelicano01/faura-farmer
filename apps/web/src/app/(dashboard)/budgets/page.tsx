import { Suspense } from 'react';
import { BudgetsManager } from '@/components/budgets/budgets-manager';

export default function BudgetsPage() {
  return (
    <Suspense fallback={null}>
      <BudgetsManager />
    </Suspense>
  );
}
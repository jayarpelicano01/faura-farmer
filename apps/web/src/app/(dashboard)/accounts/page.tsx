import { Suspense } from 'react';
import { AccountsManager } from '@/components/accounts/accounts-manager';

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsManager />
    </Suspense>
  );
}
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { useWorkspace } from '@/data/workspace-provider';

export default function Index() {
  const { status } = useSession();
  const { activeWorkspace, db } = useWorkspace();
  const [destination, setDestination] = useState<'/dashboard' | '/more' | null>(null);

  useEffect(() => {
    if (status !== 'ready' && status !== 'offline') return;
    let mounted = true;
    void db.getPendingBackupRestore()
      .then((pending) => {
        if (mounted) setDestination(pending?.workspace === activeWorkspace ? '/more' : '/dashboard');
      })
      .catch(() => {
        if (mounted) setDestination('/dashboard');
      });
    return () => { mounted = false; };
  }, [activeWorkspace, db, status]);

  return destination ? <Redirect href={destination} /> : null;
}

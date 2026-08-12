'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  PieChart,
  PiggyBank,
  Plus,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  { href: '/transactions?new=1&type=income', label: 'Log income', icon: ArrowUpFromLine },
  { href: '/transactions?new=1&type=expense', label: 'Log expense', icon: ArrowDownToLine },
  { href: '/transactions?new=1&type=transfer', label: 'Log transfer', icon: ArrowLeftRight },
  { href: '/accounts?new=1', label: 'Add account', icon: PiggyBank },
  { href: '/categories?new=1', label: 'Add category', icon: PieChart },
  { href: '/budgets?new=1', label: 'New budget', icon: Wallet },
];

export function FloatingActions() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <ul className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {actions.map((action) => (
            <li key={action.label}>
              <Link
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <action.icon className="h-4 w-4 text-primary" />
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full  text-primary-solid-foreground shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open ? 'bg-expense hover:bg-expense/90' : 'bg-primary-solid hover:bg-primary-solid/70',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  );
}
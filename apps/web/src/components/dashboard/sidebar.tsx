'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  LayoutDashboard,
  PiggyBank,
  Tags,
  ChartColumn,
  Repeat2,
  HandCoins,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/accounts', label: 'Accounts', icon: PiggyBank },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/recurring', label: 'Recurring', icon: Repeat2 },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
  { href: '/debts', label: 'Debts', icon: HandCoins },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const initials = (user.name ?? user.email ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:flex md:w-64 md:flex-col md:overflow-hidden md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-2 px-4 py-5 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold text-foreground"
        >
          <Image
            src="/favicon.png"
            alt="Faura-Farmer logo"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          Faura-Farmer
        </Link>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:px-4 md:pb-0">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-solid text-primary-solid-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-4 pb-4 md:block">
        <Separator className="mb-4" />
        <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8">
              {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  LayoutDashboard,
  PiggyBank,
  Tags,
  ChartColumn,
  LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/accounts', label: 'Accounts', icon: PiggyBank },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
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
    <aside className="border-b border-alabaster_grey bg-platinum/60 md:flex md:w-64 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-lg font-semibold text-gunmetal">
          Faura-Farmer
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:flex-1 md:flex-col md:gap-1 md:px-4 md:pb-0">
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
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate_grey hover:bg-accent hover:text-carbon_black',
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
              <p className="truncate text-sm font-medium text-carbon_black">{user.name}</p>
              <p className="truncate text-xs text-slate_grey">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
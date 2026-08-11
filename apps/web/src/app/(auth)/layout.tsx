import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground"
          >
            <Image
              src="/favicon.png"
              alt="Faura-Farmer logo"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            Faura-Farmer
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Your money, tracked from anywhere.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
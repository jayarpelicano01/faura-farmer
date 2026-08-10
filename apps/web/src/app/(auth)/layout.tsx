import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bright_snow p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-semibold text-gunmetal">
            Faura-Farmer
          </Link>
          <p className="mt-2 text-sm text-slate_grey">
            Your money, tracked from anywhere.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
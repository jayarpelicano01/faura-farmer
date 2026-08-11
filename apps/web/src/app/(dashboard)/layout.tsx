import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { FloatingActions } from '@/components/dashboard/floating-actions';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Sidebar
        user={{
          name: session.user.name ?? session.user.email,
          email: session.user.email ?? '',
          image: session.user.image ?? null,
        }}
      />
      <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      <FloatingActions />
    </div>
  );
}
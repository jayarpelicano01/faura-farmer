import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@faura-farmer/database';
import { ProfileForm } from '@/components/profile/profile-form';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatarUrl: true,
      passwordHash: true,
      oauthIdentities: { select: { provider: true } },
    },
  });
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your details and manage your sign-in methods.
        </p>
      </div>
      <ProfileForm
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          hasPassword: Boolean(user.passwordHash),
          connections: user.oauthIdentities.map((identity) => identity.provider),
        }}
      />
    </div>
  );
}

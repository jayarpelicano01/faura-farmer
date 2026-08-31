import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function AuthErrorPage() {
  const session = await auth();
  const returnToProfile = Boolean(session?.user?.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Sign-in error</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t complete sign-in with that provider. If you already have an account,
          sign in with one of its existing methods and connect the provider from Profile.
          No account information was changed.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href={returnToProfile ? '/profile' : '/login'}>
            {returnToProfile ? 'Back to profile' : 'Back to sign in'}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

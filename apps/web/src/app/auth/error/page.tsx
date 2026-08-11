import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthErrorPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Sign-in error</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Something went wrong while signing you in. This usually happens when an OAuth
          provider isn&apos;t configured yet.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
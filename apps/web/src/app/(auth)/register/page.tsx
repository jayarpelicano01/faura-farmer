'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const facebookEnabled = process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === 'true';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      router.replace('/login');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Create your account</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-expense">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-expense">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </CardContent>
      </form>
      {(googleEnabled || facebookEnabled) && (
        <>
          <div className="px-6">
            <Separator />
          </div>
          <CardFooter className="flex-col gap-2 pt-4">
            {googleEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn('google')}
              >
                Continue with Google
              </Button>
            )}
            {facebookEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn('facebook')}
              >
                Continue with Facebook
              </Button>
            )}
          </CardFooter>
        </>
      )}
      <CardFooter className="justify-center pt-4 text-sm text-slate_grey">
        Already have an account?{' '}
        <Link href="/login" className="ml-1 font-medium text-primary hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
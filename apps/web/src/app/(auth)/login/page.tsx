'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const facebookEnabled = process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function onSocial(provider: 'google' | 'facebook') {
    await signIn(provider);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Welcome back</CardTitle>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-expense">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
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
              <Button type="button" variant="outline" className="w-full" onClick={() => onSocial('google')}>
                Continue with Google
              </Button>
            )}
            {facebookEnabled && (
              <Button type="button" variant="outline" className="w-full" onClick={() => onSocial('facebook')}>
                Continue with Facebook
              </Button>
            )}
          </CardFooter>
        </>
      )}
      <CardFooter className="justify-center pt-4 text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="ml-1 font-medium text-primary hover:underline">
          Register
        </Link>
      </CardFooter>
    </Card>
  );
}
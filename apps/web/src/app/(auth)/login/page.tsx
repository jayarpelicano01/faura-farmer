'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const facebookEnabled = process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === 'true';

type Mode = 'login' | 'register';

function LoginForm() {
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

  return (
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
          {loading && <Spinner />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </CardContent>
    </form>
  );
}

function RegisterForm() {
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            {...register('name')}
          />
        </div>
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
            placeholder="Create a strong password"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-expense">{errors.password.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              At least 8 characters with an uppercase, lowercase, number and special character.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirm">Confirm password</Label>
          <Input
            id="passwordConfirm"
            type="password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            {...register('passwordConfirm')}
          />
          {errors.passwordConfirm && (
            <p className="text-sm text-expense">{errors.passwordConfirm.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Spinner />}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </CardContent>
    </form>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');

  async function onSocial(provider: 'google' | 'facebook') {
    await signIn(provider);
  }

  return (
    <Card>
      <CardHeader>
        <div className="rounded-md bg-muted p-1">
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
              className={cn(
                'rounded-md px-4 py-2 font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'login'
                  ? 'bg-primary-solid text-primary-solid-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              className={cn(
                'rounded-md px-4 py-2 font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'register'
                  ? 'bg-primary-solid text-primary-solid-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Register
            </button>
          </div>
        </div>
      </CardHeader>
      {mode === 'login' ? <LoginForm /> : <RegisterForm />}
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
                onClick={() => onSocial('google')}
              >
                Continue with Google
              </Button>
            )}
            {facebookEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onSocial('facebook')}
              >
                Continue with Facebook
              </Button>
            )}
          </CardFooter>
        </>
      )}
      <CardFooter className="justify-center pt-4 text-sm text-muted-foreground">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="ml-1 font-medium text-primary hover:underline"
            >
              Register
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="ml-1 font-medium text-primary hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
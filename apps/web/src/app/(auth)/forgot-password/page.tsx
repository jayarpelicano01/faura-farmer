'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

type ForgotInput = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: ForgotInput) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setMessage(data?.message ?? 'If an account exists for that email, a reset link has been sent.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Reset your password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {message && (
            <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Enter your account email and we&apos;ll guide you through resetting your password.
          </p>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Spinner />}
            {loading ? 'Sending…' : 'Send reset instructions'}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center pt-4 text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="ml-1 font-medium text-primary hover:underline">
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}
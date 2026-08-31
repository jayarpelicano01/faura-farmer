'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { ResetPasswordInput } from '@faura-farmer/types';
import { resetPasswordSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    if (!token) {
      setError('This password reset link is invalid or has expired.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, token }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? 'Unable to reset your password.');
      return;
    }
    setMessage(data?.message ?? 'Password updated. Please sign in.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Choose a new password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {message && (
            <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              {message}
            </p>
          )}
          {error && <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            {errors.newPassword && <p className="text-sm text-expense">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-expense">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading && <Spinner />}
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center pt-4 text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

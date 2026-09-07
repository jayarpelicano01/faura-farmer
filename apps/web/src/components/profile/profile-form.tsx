'use client';

import { useEffect, useState } from 'react';
import type { CurrencyPreference } from '@faura-farmer/types';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { GoogleIcon, FacebookIcon } from '@/components/ui/social-icons';
import { apiFetch } from '@/lib/api';

type OAuthProvider = 'google' | 'facebook';

interface ProfileUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  connections: string[];
  displayCurrency: 'PHP' | 'USD';
  usdPerPhp: string | null;
  rateDate: string | null;
  rateRefreshedAt: string | null;
}

const connectionOptions: Array<{ provider: OAuthProvider; label: string; icon: React.ComponentType<{ className?: string }>; enabled: boolean }> = [
  {
    provider: 'google',
    label: 'Google',
    icon: GoogleIcon,
    enabled: process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true',
  },
  {
    provider: 'facebook',
    label: 'Facebook',
    icon: FacebookIcon,
    enabled: process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === 'true',
  },
];

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const [connectionAction, setConnectionAction] = useState<OAuthProvider | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [preference, setPreference] = useState<CurrencyPreference>({ displayCurrency: user.displayCurrency, usdPerPhp: user.usdPerPhp, rateDate: user.rateDate, rateRefreshedAt: user.rateRefreshedAt });
  const [currencyPending, setCurrencyPending] = useState(false);

  useEffect(() => {
    const connected = searchParams.get('connection');
    if (connected !== 'google' && connected !== 'facebook') return;
    toast.success(`${connected === 'google' ? 'Google' : 'Facebook'} connected`);
    router.replace('/profile');
  }, [router, searchParams]);

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name ?? '',
      username: user.username ?? '',
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSaveProfile(values: UpdateProfileInput) {
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      await update({
        name: values.name ?? undefined,
        username: values.username ?? null,
      });
      router.refresh();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile.');
    }
  }

  async function onChangePassword(values: ChangePasswordInput) {
    try {
      await apiFetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      toast.success('Password updated. Please sign in again.');
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password.');
    }
  }

  async function onConnect(provider: OAuthProvider) {
    setConnectionAction(provider);
    setConnectionError(null);
    try {
      await apiFetch(`/api/profile/connections/${provider}`, { method: 'POST' });
      await signIn(provider, {
        callbackUrl: `${window.location.origin}/profile?connection=${provider}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start the connection.';
      setConnectionError(message);
      toast.error(message);
      setConnectionAction(null);
    }
  }

  async function onDisconnect(provider: OAuthProvider) {
    setConnectionAction(provider);
    setConnectionError(null);
    try {
      await apiFetch(`/api/profile/connections/${provider}`, { method: 'DELETE' });
      toast.success(
        `${provider === 'google' ? 'Google' : 'Facebook'} disconnected. Please sign in again.`,
      );
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to disconnect this sign-in method.';
      setConnectionError(message);
      toast.error(message);
    } finally {
      setConnectionAction(null);
    }
  }

  async function changeCurrency(displayCurrency: 'PHP' | 'USD') {
    if (displayCurrency === 'USD' && !preference.usdPerPhp) {
      toast.error('Refresh the exchange rate before switching to USD.');
      return;
    }
    setCurrencyPending(true);
    try {
      const response = await apiFetch<{ user: { preference: CurrencyPreference } }>('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayCurrency }) });
      setPreference(response.user.preference);
      toast.success(`Display currency changed to ${displayCurrency}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change display currency.');
    } finally { setCurrencyPending(false); }
  }

  async function refreshRate() {
    setCurrencyPending(true);
    try {
      const response = await apiFetch<{ preference: CurrencyPreference }>('/api/profile/currency-rate', { method: 'POST' });
      setPreference((current) => ({ ...response.preference, displayCurrency: current.displayCurrency }));
      toast.success('Exchange rate refreshed');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to refresh the exchange rate.');
    } finally { setCurrencyPending(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Profile details</CardTitle>
        </CardHeader>
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                autoComplete="name"
                {...profileForm.register('name')}
              />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-expense">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                autoComplete="username"
                {...profileForm.register('username')}
              />
              {profileForm.formState.errors.username && (
                <p className="text-sm text-expense">
                  {profileForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={user.email} readOnly disabled />
            </div>
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              {profileForm.formState.isSubmitting ? 'Saving…' : 'Save profile'}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Display currency</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Show amounts in PHP or USD. Saved balances and transactions remain unchanged.</p>
          <div className="flex gap-2">
            {(['PHP', 'USD'] as const).map((currency) => <Button key={currency} disabled={currencyPending || preference.displayCurrency === currency} type="button" variant={preference.displayCurrency === currency ? 'default' : 'outline'} onClick={() => void changeCurrency(currency)}>{currency}</Button>)}
          </div>
          <p className="text-xs text-muted-foreground">{preference.usdPerPhp ? `1 PHP = ${preference.usdPerPhp} USD${preference.rateDate ? ` · rate date ${preference.rateDate}` : ''}` : 'No USD rate is cached yet.'}</p>
          <Button disabled={currencyPending} type="button" variant="outline" onClick={() => void refreshRate()}>{currencyPending ? 'Refreshing…' : 'Refresh rate'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Sign-in methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect Google or Facebook to sign in with either provider. Providers are only linked
            when you start the connection here.
          </p>
          {connectionError && (
            <p role="alert" className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">
              {connectionError}
            </p>
          )}
          <div className="divide-y divide-border rounded-md border border-border">
            {connectionOptions.map((option) => {
              const connected = user.connections.includes(option.provider);
              const isLoading = connectionAction === option.provider;
              const disabled = connectionAction !== null || (!connected && !option.enabled);
              return (
                <div
                  key={option.provider}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {connected
                        ? 'Connected'
                        : option.enabled
                          ? 'Not connected'
                          : 'Unavailable on this deployment'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={connected ? 'outline' : 'default'}
                    disabled={disabled}
                    onClick={() => (connected ? onDisconnect(option.provider) : onConnect(option.provider))}
                  >
                    {isLoading && <Spinner />}
                    {isLoading ? 'Please wait…' : connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {user.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Change password</CardTitle>
          </CardHeader>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} noValidate>
            <CardContent className="space-y-4">
              <Separator className="mb-4" />
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-expense">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword ? (
                  <p className="text-sm text-expense">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters with an uppercase, lowercase, number and special
                    character.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-expense">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? 'Updating…' : 'Update password'}
              </Button>
            </CardContent>
          </form>
        </Card>
      )}
    </div>
  );
}

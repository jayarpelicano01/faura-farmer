'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
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
import { apiFetch } from '@/lib/api';

interface ProfileUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  authProvider: string;
  avatarUrl: string | null;
}

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const { update } = useSession();
  const isEmailAccount = user.authProvider === 'email';

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

      {isEmailAccount && (
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

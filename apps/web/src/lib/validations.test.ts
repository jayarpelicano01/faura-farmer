import { describe, expect, it } from 'vitest';
import { resetPasswordSchema } from './validations';

describe('reset password validation', () => {
  const strongPassword = 'A-secure-password-1';

  it('accepts a token and matching strong password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'a'.repeat(43),
      newPassword: strongPassword,
      confirmPassword: strongPassword,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a short token and mismatched confirmation', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'short',
      newPassword: strongPassword,
      confirmPassword: 'different-password-1-A',
    });

    expect(result.success).toBe(false);
  });
});

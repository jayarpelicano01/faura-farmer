type PasswordResetEmail = {
  email: string;
  token: string;
};

function getResetUrl(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured');

  const url = new URL('/reset-password', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendPasswordResetEmail({ email, token }: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Resend is not configured');

  const resetUrl = getResetUrl(token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your Faura-Farmer password',
      text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Resend email request failed with ${response.status}`);
}

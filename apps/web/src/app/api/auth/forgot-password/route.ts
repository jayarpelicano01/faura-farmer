import { badRequest } from '@/lib/http';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) return badRequest('Email is required');

  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    return Response.json(
      {
        message:
          'Password reset emails are not configured in this environment yet. ' +
          'Please contact the site owner to reset your password.',
      },
      { status: 200 },
    );
  }

  return Response.json(
    { message: 'If an account exists for that email, a reset link has been sent.' },
    { status: 200 },
  );
}
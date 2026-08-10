import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, status: init?.status ?? 200 });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export function unauthorized() {
  return fail('Unauthorized', 401, 'UNAUTHORIZED');
}

export function notFound(message = 'Not found') {
  return fail(message, 404, 'NOT_FOUND');
}

export function badRequest(message = 'Bad request') {
  return fail(message, 400, 'BAD_REQUEST');
}
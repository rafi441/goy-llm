import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiValidationError('Invalid JSON body');
  }
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.errors[0];
      throw new ApiValidationError(
        first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Validation failed',
      );
    }
    throw e;
  }
}

export class ApiValidationError extends Error {}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ApiValidationError) return apiError(e.message, 422);
  const message = e instanceof Error ? e.message : 'Unexpected error';
  return apiError(message, 500);
}

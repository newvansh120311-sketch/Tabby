import { NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });

export async function body<S extends ZodSchema>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'The request body isn’t valid JSON.');
  }
  return schema.parse(raw);
}

/** Wrap a route handler so thrown errors become tidy JSON responses. */
export function route<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => {
    try {
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return json({ error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', issues: e.issues }, 422);
      }
      console.error(e);
      return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
    }
  };
}

export type Ctx<P> = { params: Promise<P> };

import { NextResponse } from 'next/server';

/**
 * Wraps a Route Handler so any thrown error - a misconfigured env var, a DB
 * connection failure, an unexpected exception anywhere in the function -
 * always produces a clean, parseable JSON response instead of letting it
 * propagate uncaught. An uncaught exception in a Route Handler gets handled
 * by Next.js's own platform-level error handling, which does NOT return
 * `NextResponse.json({ error })` the way this app's routes are written to
 * - it can return an empty or non-JSON body, which breaks any client code
 * that does `await res.json()` on the response with a confusing
 * "Unexpected end of JSON input" error that has nothing to do with the
 * actual failure.
 */
export function withErrorHandling<Args extends any[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error('[emblem] Unhandled API error', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
  };
}

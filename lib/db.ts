import 'server-only';

// Everything the Next.js app actually needs lives in db-core.ts, which is
// deliberately NOT guarded by 'server-only' so the CLI scripts (migrate.ts,
// seed.ts) can import it directly via plain tsx. This file adds the guard
// for every other import site in the app — Server Components and Route
// Handlers should always import from '@/lib/db', never '@/lib/db-core'
// directly, so a future accidental client-bundle import still gets caught
// at build time.
export { getPool, query, queryOne } from './db-core';

import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { withErrorHandling } from '@/lib/api-error';

export const runtime = 'nodejs';

async function GETHandler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const totals = await queryOne<{
    total_executions: string;
    today: string;
    this_week: string;
    this_month: string;
    failed_auth: string;
    revoked_attempts: string;
    replay_blocked: string;
  }>(`SELECT
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'payload_fetch') AS total_executions,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'payload_fetch' AND created_at > date_trunc('day', now())) AS today,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'payload_fetch' AND created_at > now() - interval '7 days') AS this_week,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'payload_fetch' AND created_at > now() - interval '30 days') AS this_month,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'auth_fail' AND created_at > now() - interval '7 days') AS failed_auth,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'revoked_attempt' AND created_at > now() - interval '7 days') AS revoked_attempts,
      (SELECT COUNT(*) FROM script_usage WHERE event_type = 'replay_blocked' AND created_at > now() - interval '7 days') AS replay_blocked
  `);

  const activeUsers = await queryOne<{ count: string }>(
    `SELECT COUNT(DISTINCT key_id) AS count FROM script_usage WHERE event_type = 'payload_fetch' AND created_at > now() - interval '7 days'`
  );

  const { rows: topKeys } = await query(
    `SELECT keys.key_preview, keys.usage_count, users.username AS owner_username
     FROM keys LEFT JOIN users ON users.id = keys.user_id
     ORDER BY keys.usage_count DESC LIMIT 10`
  );

  const { rows: topVersions } = await query(
    `SELECT script_versions.version, COUNT(*) AS fetches
     FROM script_usage JOIN script_versions ON script_versions.id = script_usage.version_id
     WHERE script_usage.event_type = 'payload_fetch'
     GROUP BY script_versions.version ORDER BY fetches DESC LIMIT 10`
  );

  const { rows: rateLimitEvents } = await query(
    `SELECT bucket, COUNT(*) AS hits FROM rate_limit_hits WHERE created_at > now() - interval '24 hours'
     GROUP BY bucket ORDER BY hits DESC LIMIT 20`
  );

  return NextResponse.json({
    totals,
    activeUsersThisWeek: activeUsers?.count ?? '0',
    topKeys,
    topVersions,
    rateLimitEvents,
  });
}

export const GET = withErrorHandling(GETHandler);


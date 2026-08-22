// Run with: npm run migrate
// Applies db/schema.sql (idempotent — safe to re-run) and, if
// INITIAL_ADMIN_EMAIL is set and that user already exists, promotes them
// to admin so there's a way into the admin dashboard on a fresh deploy.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getPool } from '../lib/db';

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('[emblem] Applying schema...');
  await getPool().query(sql);
  console.log('[emblem] Schema applied.');

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  if (adminEmail) {
    const result = await getPool().query(
      `UPDATE users SET role = 'admin' WHERE email = $1 AND role != 'admin' AND role != 'owner' RETURNING username`,
      [adminEmail.toLowerCase()]
    );
    if (result.rows.length > 0) {
      console.log(`[emblem] Promoted ${result.rows[0].username} (${adminEmail}) to admin.`);
    } else {
      console.log(
        `[emblem] No existing user with email ${adminEmail} to promote yet — register that account first, then re-run migrate, or run:\n` +
          `  UPDATE users SET role = 'admin' WHERE email = '${adminEmail}';`
      );
    }
  }

  await getPool().end();
}

main().catch((err) => {
  console.error('[emblem] Migration failed:', err);
  process.exit(1);
});

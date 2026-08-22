// Optional: seeds a few example pricing plans so /pricing isn't empty on a
// fresh deploy. Edit the values below (or just manage plans from the admin
// dashboard instead — this is a convenience, not a requirement).
// Run with: npx tsx db/seed.ts
import 'dotenv/config';
import { pool, query } from '../lib/db';

async function main() {
  const existing = await query(`SELECT COUNT(*) AS count FROM pricing_plans`);
  if (parseInt(existing.rows[0].count, 10) > 0) {
    console.log('[emblem] Pricing plans already exist — skipping seed. Delete existing rows first if you want to reseed.');
    await pool.end();
    return;
  }

  await query(
    `INSERT INTO pricing_plans (name, description, price_cents, currency, duration_days, features, sort_order) VALUES
     ('Daily', 'Try it out.', 299, 'gbp', 1, ARRAY['Full script access', 'Standard support'], 0),
     ('Weekly', 'Most popular.', 999, 'gbp', 7, ARRAY['Full script access', 'Priority support', 'Early access to updates'], 1),
     ('Lifetime', 'Pay once.', 2999, 'gbp', NULL, ARRAY['Full script access', 'Priority support', 'Early access to updates', 'Lifetime updates'], 2)
    `
  );

  console.log('[emblem] Seeded 3 example pricing plans (GBP). Edit or replace them from /dashboard/admin/plans.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});






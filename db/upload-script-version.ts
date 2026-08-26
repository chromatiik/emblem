// Uploads a .lua file as a new script_version — built specifically because
// pasting a large script through the admin dashboard's textarea is
// impractical once you're past a few hundred KB. Functionally identical
// to POST /api/admin/scripts, just run locally against the database
// directly instead of through the authenticated HTTP API.
//
// Usage:
//   npx tsx db/upload-script-version.ts <file.lua> <version> [--enable] [--notes "..."] [--executors "Xeno,Solara"]
//
// Examples:
//   npx tsx db/upload-script-version.ts ./Emblem.lua 1.0.0 --enable
//   npx tsx db/upload-script-version.ts ./Emblem.lua 1.1.0 --enable --notes "Fixed aimbot FOV bug" --executors "Xeno,Solara,Wave"
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getPool, query } from '../lib/db-core';

const MAX_PAYLOAD_CHARS = 2_000_000; // matches the admin API's own limit

function parseArgs(argv: string[]) {
  const [filePath, version, ...rest] = argv;
  if (!filePath || !version) {
    console.error('Usage: npx tsx db/upload-script-version.ts <file.lua> <version> [--enable] [--notes "..."] [--executors "A,B,C"]');
    process.exit(1);
  }

  let enable = false;
  let notes = '';
  let executors: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--enable') enable = true;
    else if (rest[i] === '--notes') notes = rest[++i] || '';
    else if (rest[i] === '--executors') executors = (rest[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  return { filePath, version, enable, notes, executors };
}

async function main() {
  const { filePath, version, enable, notes, executors } = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[emblem] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const payload = fs.readFileSync(resolvedPath, 'utf8');
  if (payload.length === 0) {
    console.error('[emblem] File is empty.');
    process.exit(1);
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
    console.error(`[emblem] File is ${payload.length.toLocaleString()} chars, which exceeds the ${MAX_PAYLOAD_CHARS.toLocaleString()} char limit.`);
    process.exit(1);
  }

  console.log(`[emblem] Uploading ${resolvedPath} (${payload.length.toLocaleString()} chars) as version ${version}...`);

  const result = await query<{ id: string }>(
    `INSERT INTO script_versions (version, release_notes, payload, supported_executors, is_enabled)
     VALUES ($1, $2, $3, $4, FALSE) RETURNING id`,
    [version, notes, payload, executors]
  );
  const versionId = result.rows[0]?.id;

  if (enable) {
    await query(`UPDATE script_versions SET is_enabled = FALSE WHERE is_enabled = TRUE`);
    await query(`UPDATE script_versions SET is_enabled = TRUE WHERE id = $1`, [versionId]);
    await query(
      `INSERT INTO configuration (key, value, updated_at) VALUES ('current_version', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [version]
    );
    await query(
      `INSERT INTO configuration (key, value, updated_at) VALUES ('script_status', 'online', now())
       ON CONFLICT (key) DO UPDATE SET value = 'online', updated_at = now()`
    );
    console.log(`[emblem] Uploaded and enabled as the active version (id: ${versionId}). Status set to online.`);
  } else {
    console.log(`[emblem] Uploaded as an inactive version (id: ${versionId}). Enable it from /dashboard/admin/scripts when ready.`);
  }

  await getPool().end();
}

main().catch((err) => {
  console.error('[emblem] Upload failed:', err);
  process.exit(1);
});

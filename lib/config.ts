import 'server-only';

import { queryOne, query } from './db';

export async function getConfig(key: string, fallback = ''): Promise<string> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM configuration WHERE key = $1`, [key]);
  return row?.value ?? fallback;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO configuration (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, value]
  );
}

export async function getPublicConfig() {
  const [discordUrl, scriptStatus, currentVersion] = await Promise.all([
    getConfig('discord_invite_url', process.env.DISCORD_INVITE_URL || 'https://discord.gg/'),
    getConfig('script_status', 'online'),
    getConfig('current_version', '1.0.0'),
  ]);
  return { discordUrl, scriptStatus, currentVersion };
}

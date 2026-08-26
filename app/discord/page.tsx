import { redirect } from 'next/navigation';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DiscordRedirect() {
  const url = await getConfig('discord_invite_url', process.env.DISCORD_INVITE_URL || 'https://discord.gg/');
  redirect(url);
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteBackground } from '@/components/SiteBackground';
import { SiteNav } from '@/components/SiteNav';
import { queryOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CopyButton } from '@/components/CopyButton';

export const dynamic = 'force-dynamic';

export default async function ConfigDetailPage({ params }: { params: { id: string } }) {
  const config = await queryOne<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    config_json: string;
    download_count: number;
    created_at: string;
    user_id: string;
    author: string;
  }>(
    `SELECT marketplace_configs.id, marketplace_configs.name, marketplace_configs.description, marketplace_configs.tags,
            marketplace_configs.config_json, marketplace_configs.download_count, marketplace_configs.created_at,
            marketplace_configs.user_id, users.username AS author
     FROM marketplace_configs
     JOIN users ON users.id = marketplace_configs.user_id
     WHERE marketplace_configs.id = $1`,
    [params.id]
  );

  if (!config) notFound();

  const user = await getCurrentUser().catch(() => null);
  let downloadCount = config.download_count;
  if (user) {
    const { rows: inserted } = await query(
      `INSERT INTO marketplace_downloads (config_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING config_id`,
      [config.id, user.id]
    );
    if (inserted.length > 0) {
      await query(`UPDATE marketplace_configs SET download_count = download_count + 1 WHERE id = $1`, [config.id]);
      downloadCount += 1;
    }
  }

  return (
    <>
      <SiteBackground />
      <SiteNav />
      <main className="relative z-10 mx-auto max-w-5xl px-6 py-24">
        <Link href="/marketplace" className="text-sm font-medium text-neutral-400 hover:text-ink">
          ← Back to marketplace
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-8">
            <h1 className="text-3xl font-bold text-ink">{config.name}</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-wide text-neutral-500">
              by {config.author} · {new Date(config.created_at).toLocaleDateString()}
            </p>
            <p className="mt-4 text-neutral-300">{config.description || 'No description provided.'}</p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {config.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/marketplace?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-neutral-400 hover:bg-white/[0.06] hover:text-ink"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <div className="mt-8 flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/60 p-5 shadow-xl backdrop-blur">
              <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-white">
                <code>{config.config_json}</code>
              </pre>
              <CopyButton text={config.config_json} />
            </div>
            {!user && (
              <p className="mt-3 text-xs text-neutral-500">
                <Link href="/login" className="underline underline-offset-2 hover:text-ink">
                  Log in
                </Link>{' '}
                to have this count toward the uploader's download total.
              </p>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-2xl font-bold text-ink">{downloadCount}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Downloads</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

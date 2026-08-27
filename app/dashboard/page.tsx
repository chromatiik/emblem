import { getCurrentUser } from '@/lib/auth';
import { DashboardOverview } from '@/components/DashboardOverview';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">Account</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">
        {greeting()}
        {user ? <>, {user.username}</> : null}.
      </h1>
      <p className="mt-1 font-mono text-sm text-neutral-500">Everything tied to your account.</p>

      <DashboardOverview />
    </div>
  );
}

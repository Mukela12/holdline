import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { checkProOnboardingStatus, connectProAccount } from '@/app/actions';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Awaiting client funding',
  FUNDED: 'Held in escrow, awaiting client approval',
  RELEASED: 'Paid out',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'badge--draft',
  FUNDED: 'badge--funded',
  RELEASED: 'badge--released',
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ProDashboard({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const pro = await prisma.user.findUnique({ where: { id: userId } });
  if (!pro || pro.role !== 'PRO') notFound();

  const onboarded = pro.stripeAccountId ? await checkProOnboardingStatus(userId) : false;

  const gigs = await prisma.gig.findMany({
    where: { proId: userId },
    include: { client: true, milestones: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarned = gigs
    .flatMap((g) => g.milestones)
    .filter((m) => m.status === 'RELEASED')
    .reduce((sum, m) => sum + Math.round((m.amountCents * (10000 - m.platformFeeBps)) / 10000), 0);

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Pro dashboard</p>
        <Link href="/" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>← Switch user</Link>
      </div>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] mb-8">{pro.name}</h1>

      <div className="card-surface p-6 mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13.5px] font-medium mb-1">Payout account</p>
          <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
            {onboarded
              ? 'Connected. Milestone releases pay out to this Stripe account automatically.'
              : 'Connect a Stripe account to receive milestone releases.'}
          </p>
        </div>
        {onboarded ? (
          <span className="badge badge--released shrink-0">Connected</span>
        ) : (
          <form action={connectProAccount.bind(null, userId)}>
            <button type="submit" className="btn btn--primary shrink-0">Connect payout account →</button>
          </form>
        )}
      </div>

      <div className="card-surface p-5 mb-10 max-w-xs">
        <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>Total earned (after fee)</p>
        <p className="stat-num text-[26px] font-semibold">{money(totalEarned)}</p>
      </div>

      <p className="eyebrow mb-4">Assigned gigs</p>
      <div className="space-y-5">
        {gigs.length === 0 && <div className="empty-state">No gigs assigned yet.</div>}
        {gigs.map((gig) => (
          <div key={gig.id} className="card-surface p-6">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h3 className="font-display text-[16px] font-semibold">{gig.title}</h3>
              <span className="text-[12.5px] shrink-0" style={{ color: 'var(--text-muted)' }}>Client: {gig.client.name}</span>
            </div>
            <p className="text-[13.5px] mb-4" style={{ color: 'var(--text-secondary)' }}>{gig.description}</p>

            <div className="space-y-2">
              {gig.milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-center justify-between border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-[13.5px]">{milestone.title}</span>
                    <span className={`badge ${STATUS_CLASS[milestone.status]}`}>{STATUS_LABEL[milestone.status]}</span>
                  </div>
                  <span className="stat-num text-[13.5px]">
                    {money(Math.round((milestone.amountCents * (10000 - milestone.platformFeeBps)) / 10000))} your share
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

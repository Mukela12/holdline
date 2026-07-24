import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createGig, fundMilestone, releaseMilestone } from '@/app/actions';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Awaiting funding',
  FUNDED: 'Held in escrow',
  RELEASED: 'Released',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'badge--draft',
  FUNDED: 'badge--funded',
  RELEASED: 'badge--released',
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const client = await prisma.user.findUnique({ where: { id: userId } });
  if (!client || client.role !== 'CLIENT') notFound();

  const gigs = await prisma.gig.findMany({
    where: { clientId: userId },
    include: { pro: true, milestones: { include: { events: { orderBy: { createdAt: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const pros = await prisma.user.findMany({ where: { role: 'PRO' }, orderBy: { name: 'asc' } });

  const totalHeld = gigs.flatMap((g) => g.milestones).filter((m) => m.status === 'FUNDED').reduce((sum, m) => sum + m.amountCents, 0);
  const totalReleased = gigs.flatMap((g) => g.milestones).filter((m) => m.status === 'RELEASED').reduce((sum, m) => sum + m.amountCents, 0);

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Client dashboard</p>
        <Link href="/" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>← Switch user</Link>
      </div>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] mb-8">{client.name}</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card-surface p-5">
          <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>Currently held in escrow</p>
          <p className="stat-num text-[26px] font-semibold">{money(totalHeld)}</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>Released to pros</p>
          <p className="stat-num text-[26px] font-semibold">{money(totalReleased)}</p>
        </div>
      </div>

      <div className="card-surface p-6 mb-10">
        <p className="eyebrow mb-4">New gig</p>
        <form action={createGig} className="grid sm:grid-cols-2 gap-4">
          <input type="hidden" name="clientId" value={userId} />
          <div className="sm:col-span-2">
            <label className="text-[12.5px] font-medium block mb-1.5">Title</label>
            <input name="title" required className="field" placeholder="Booking calendar for a Next.js site" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[12.5px] font-medium block mb-1.5">Description</label>
            <textarea name="description" required rows={2} className="field" placeholder="What does the pro need to deliver?" />
          </div>
          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Assign to</label>
            <select name="proId" required className="field">
              {pros.map((pro) => (
                <option key={pro.id} value={pro.id}>{pro.name}</option>
              ))}
            </select>
          </div>
          <div />
          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Milestone 1 title</label>
            <input name="milestoneTitle" required className="field" placeholder="Design and build the core flow" />
          </div>
          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Amount (USD)</label>
            <input name="amountDollars" type="number" min="1" step="0.01" required className="field" placeholder="450.00" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn--primary">Create gig</button>
          </div>
        </form>
      </div>

      <p className="eyebrow mb-4">Your gigs</p>
      <div className="space-y-5">
        {gigs.length === 0 && <div className="empty-state">No gigs yet. Create one above.</div>}
        {gigs.map((gig) => (
          <div key={gig.id} className="card-surface p-6">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h3 className="font-display text-[16px] font-semibold">{gig.title}</h3>
              <span className="text-[12.5px] shrink-0" style={{ color: 'var(--text-muted)' }}>Pro: {gig.pro?.name}</span>
            </div>
            <p className="text-[13.5px] mb-4" style={{ color: 'var(--text-secondary)' }}>{gig.description}</p>

            <div className="space-y-3">
              {gig.milestones.map((milestone) => (
                <div key={milestone.id} className="border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-[13.5px]">{milestone.title}</span>
                      <span className={`badge ${STATUS_CLASS[milestone.status]}`}>{STATUS_LABEL[milestone.status]}</span>
                    </div>
                    <span className="stat-num text-[14px] font-semibold">{money(milestone.amountCents)}</span>
                  </div>

                  {milestone.status === 'DRAFT' && (
                    <form action={fundMilestone.bind(null, milestone.id, userId)}>
                      <button type="submit" className="btn btn--primary text-[12.5px] py-2 px-3">
                        Fund via Stripe Checkout →
                      </button>
                    </form>
                  )}

                  {milestone.status === 'FUNDED' && (
                    <form action={releaseMilestone.bind(null, milestone.id, userId)}>
                      <button type="submit" className="btn btn--primary text-[12.5px] py-2 px-3">
                        Approve &amp; release payment
                      </button>
                    </form>
                  )}

                  {milestone.events.length > 0 && (
                    <ul className="mt-3 space-y-2 pl-0.5">
                      {milestone.events.map((event) => (
                        <li key={event.id} className="flex gap-2.5">
                          <span
                            className="timeline-dot"
                            style={{ background: event.type === 'RELEASED' ? 'var(--success)' : 'var(--warning)' }}
                          />
                          <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{event.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

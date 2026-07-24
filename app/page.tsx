import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const clients = users.filter((u) => u.role === 'CLIENT');
  const pros = users.filter((u) => u.role === 'PRO');

  return (
    <main className="flex-1">
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-14">
        <p className="eyebrow mb-4">Milestone escrow, live on Stripe Connect test mode</p>
        <h1 className="font-display text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] mb-5">
          Client funds a milestone. It holds on the platform. Approval splits{' '}
          <span className="italic" style={{ color: 'var(--primary)' }}>90/10</span> automatically.
        </h1>
        <p className="text-[16px] leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          Holdline is a small, real dual-sided marketplace: Clients post gigs with milestones, fund them through a
          genuine Stripe Checkout session, and the money sits on the platform&apos;s balance, not the Pro&apos;s,
          until the Client approves the work. Approval triggers a real Stripe transfer for the Pro&apos;s 90% share
          and keeps 10% as the platform fee. No mock data on the money path, every charge, hold, and release below
          is a live Stripe API call in test mode.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 grid sm:grid-cols-2 gap-5">
        <div className="card-surface p-6">
          <p className="eyebrow mb-3">Clients</p>
          <p className="text-[14px] mb-5" style={{ color: 'var(--text-secondary)' }}>
            Create a gig, fund a milestone, and release payment once the work is approved.
          </p>
          <div className="flex flex-col gap-2">
            {clients.map((client) => (
              <Link key={client.id} href={`/client/${client.id}`} className="btn btn--secondary justify-between">
                {client.name}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-surface p-6">
          <p className="eyebrow mb-3">Pros</p>
          <p className="text-[14px] mb-5" style={{ color: 'var(--text-secondary)' }}>
            Connect a Stripe payout account and watch milestones move from held to released.
          </p>
          <div className="flex flex-col gap-2">
            {pros.map((pro) => (
              <Link key={pro.id} href={`/pro/${pro.id}`} className="btn btn--secondary justify-between">
                {pro.name}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="card-surface p-6">
          <p className="eyebrow mb-4">How the escrow mechanism works</p>
          <ol className="space-y-3 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
            <li><strong style={{ color: 'var(--foreground)' }}>1. Fund.</strong> The Client pays through a real Stripe Checkout Session. No transfer destination is set at charge time, so the full amount lands on the platform&apos;s own Stripe balance, that is the hold.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>2. Verify.</strong> A signature-verified webhook (<code className="font-mono text-[12.5px]">checkout.session.completed</code>) flips the milestone to Funded, never the client-facing redirect alone.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>3. Release.</strong> When the Client approves, the server creates a real Stripe transfer for 90% of the milestone to the Pro&apos;s connected account (Stripe Accounts v2, Recipient configuration) and keeps 10% as the platform fee.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

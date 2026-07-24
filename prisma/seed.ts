import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const client = await prisma.user.upsert({
    where: { email: 'jordan@northlane.co' },
    update: {},
    create: { name: 'Jordan Reyes', role: 'CLIENT', email: 'jordan@northlane.co' },
  });

  const client2 = await prisma.user.upsert({
    where: { email: 'priya@fernbank.io' },
    update: {},
    create: { name: 'Priya Nair', role: 'CLIENT', email: 'priya@fernbank.io' },
  });

  const pro = await prisma.user.upsert({
    where: { email: 'aisha@buildworks.dev' },
    update: {},
    create: { name: 'Aisha Bello', role: 'PRO', email: 'aisha@buildworks.dev' },
  });

  const pro2 = await prisma.user.upsert({
    where: { email: 'marcus@formcraft.dev' },
    update: {},
    create: { name: 'Marcus Webb', role: 'PRO', email: 'marcus@formcraft.dev' },
  });

  const existingGigs = await prisma.gig.count();
  if (existingGigs > 0) {
    console.log('Gigs already seeded, skipping.');
    await prisma.$disconnect();
    return;
  }

  const gig1 = await prisma.gig.create({
    data: {
      title: 'Booking calendar for a Next.js site',
      description: 'Add a booking calendar with email confirmations and a simple admin view of upcoming bookings.',
      clientId: client.id,
      proId: pro.id,
    },
  });

  await prisma.milestone.create({
    data: {
      gigId: gig1.id,
      title: 'Milestone 1: Calendar UI and booking form',
      amountCents: 45000,
      status: 'RELEASED',
      releasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      fundedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      events: {
        create: [
          { type: 'FUNDED', detail: 'Client funded $450.00 via Stripe Checkout.' },
          { type: 'RELEASED', detail: 'Client approved the milestone. $405.00 transferred to Aisha, $45.00 platform fee retained.' },
        ],
      },
    },
  });

  const gig2 = await prisma.gig.create({
    data: {
      title: 'Invoice PDF export for a client portal',
      description: 'Generate a branded PDF invoice from order data and email it to the customer automatically.',
      clientId: client2.id,
      proId: pro2.id,
    },
  });

  await prisma.milestone.create({
    data: {
      gigId: gig2.id,
      title: 'Milestone 1: PDF template and generation endpoint',
      amountCents: 32000,
      status: 'DRAFT',
    },
  });

  const gig3 = await prisma.gig.create({
    data: {
      title: 'Lead-scoring dashboard widget',
      description: 'Add a widget summarizing lead score distribution for the sales team.',
      clientId: client.id,
      proId: pro2.id,
    },
  });

  await prisma.milestone.create({
    data: {
      gigId: gig3.id,
      title: 'Milestone 1: Score aggregation and chart',
      amountCents: 28000,
      status: 'DRAFT',
    },
  });

  console.log('Seed complete.');
  console.log({ client: client.id, client2: client2.id, pro: pro.id, pro2: pro2.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

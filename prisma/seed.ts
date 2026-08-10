import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const business = await prisma.business.create({
    data: {
      name: 'Glow Salon',
      email: 'owner@glowsalon.com',
      apiKey: 'test-api-key-123',
    },
  });

  const now = new Date();
  const slots: {
    businessId: string;
    startTime: Date;
    endTime: Date;
    isBooked: boolean;
  }[] = [];

  for (let i = 1; i <= 5; i++) {
    const start = new Date(now.getTime() + i * 60 * 60 * 1000); // i hours from now
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min slot
    slots.push({
      businessId: business.id,
      startTime: start,
      endTime: end,
      isBooked: false,
    });
  }

  await prisma.slot.createMany({ data: slots });

  console.log('Seeded business:', business);
  console.log('Seeded', slots.length, 'slots');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
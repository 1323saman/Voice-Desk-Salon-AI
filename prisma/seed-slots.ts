import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ---- Config: tweak these to match your real business hours ----
const DAYS_AHEAD = 30; // how many calendar days forward to generate slots for
const SLOT_DURATION_MINUTES = 30;
const BUSINESS_START_HOUR = 9; // 9 AM
const BUSINESS_END_HOUR = 17; // 5 PM
const SKIP_WEEKENDS = true;
const TIMEZONE_OFFSET = '+05:00'; // match your business's timezone

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Creating appointment slots...');

    const business = await prisma.business.findFirst();

    if (!business) {
      throw new Error(
        'No business found in the database. Please create a Business first.',
      );
    }

    console.log(`Using business: ${business.name}`);
    console.log(`Business ID: ${business.id}`);

    const slots: { startTime: Date; endTime: Date }[] = [];
    const today = new Date();

    for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);

      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (SKIP_WEEKENDS && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue;
      }

      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      for (
        let minutes = BUSINESS_START_HOUR * 60;
        minutes < BUSINESS_END_HOUR * 60;
        minutes += SLOT_DURATION_MINUTES
      ) {
        const hour = Math.floor(minutes / 60)
          .toString()
          .padStart(2, '0');
        const minute = (minutes % 60).toString().padStart(2, '0');

        const startTime = new Date(
          `${dateStr}T${hour}:${minute}:00${TIMEZONE_OFFSET}`,
        );
        const endTime = new Date(
          startTime.getTime() + SLOT_DURATION_MINUTES * 60000,
        );

        // Skip slots that are already in the past (relevant for today only)
        if (startTime.getTime() < Date.now()) {
          continue;
        }

        slots.push({ startTime, endTime });
      }
    }

    console.log(`Generated ${slots.length} candidate slots.`);

    let created = 0;
    let skipped = 0;

    for (const slot of slots) {
      const existingSlot = await prisma.slot.findFirst({
        where: {
          businessId: business.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });

      if (existingSlot) {
        skipped++;
        continue;
      }

      await prisma.slot.create({
        data: {
          businessId: business.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBooked: false,
        },
      });

      created++;
    }

    console.log('');
    console.log(`Created ${created} new slots.`);
    console.log(`Skipped ${skipped} slots (already existed).`);
    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to create test slots:', error);
  process.exit(1);
});
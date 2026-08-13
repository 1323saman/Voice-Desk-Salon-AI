
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured.',
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    console.log(
      'Creating test appointment slots...',
    );

    // Find the first business
    const business =
      await prisma.business.findFirst();

    if (!business) {
      throw new Error(
        'No business found in the database. Please create a Business first.',
      );
    }

    console.log(
      `Using business: ${business.name}`,
    );

    console.log(
      `Business ID: ${business.id}`,
    );

    // Test appointment slots
    const slots = [
      {
        startTime: new Date(
          '2026-08-10T20:53:00+05:00',
        ),
        endTime: new Date(
          '2026-08-10T21:23:00+05:00',
        ),
      },
      {
        startTime: new Date(
          '2026-08-10T21:33:00+05:00',
        ),
        endTime: new Date(
          '2026-08-10T22:03:00+05:00',
        ),
      },
      {
        startTime: new Date(
          '2026-08-10T22:13:00+05:00',
        ),
        endTime: new Date(
          '2026-08-10T22:43:00+05:00',
        ),
      },
      {
        startTime: new Date(
          '2026-08-10T22:53:00+05:00',
        ),
        endTime: new Date(
          '2026-08-10T23:23:00+05:00',
        ),
      },
    ];

    for (const slot of slots) {
      const existingSlot =
        await prisma.slot.findFirst({
          where: {
            businessId: business.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        });

      if (existingSlot) {
        console.log(
          `Slot already exists: ${slot.startTime.toLocaleString()}`,
        );

        continue;
      }

      const createdSlot =
        await prisma.slot.create({
          data: {
            businessId: business.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isBooked: false,
          },
        });

      console.log(
        `Created slot: ${createdSlot.id}`,
      );

      console.log(
        `Time: ${createdSlot.startTime.toLocaleString()} - ${createdSlot.endTime.toLocaleString()}`,
      );
    }

    console.log('');
    console.log(
      'Test appointment slots created successfully.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    'Failed to create test slots:',
    error,
  );

  process.exit(1);
});

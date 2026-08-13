import 'dotenv/config';

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pipeline } from '@xenova/transformers';

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is missing from your .env file.',
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

let extractor: any;

/**
 * Load the local embedding model.
 *
 * Model:
 * Xenova/all-MiniLM-L6-v2
 *
 * Dimension:
 * 384
 */
async function getExtractor(): Promise<any> {
  if (!extractor) {
    console.log(
      'Loading local embedding model...',
    );

    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );

    console.log(
      'Local embedding model loaded.',
    );
  }

  return extractor;
}

/**
 * Generate a 384-dimensional embedding locally.
 */
async function createEmbedding(
  text: string,
): Promise<number[]> {
  const model =
    await getExtractor();

  const output = await model(text, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding =
    Array.from(output.data) as number[];

  if (embedding.length !== 384) {
    throw new Error(
      `Expected 384-dimensional embedding but received ${embedding.length}.`,
    );
  }

  return embedding;
}

async function main(): Promise<void> {
  /*
   * Find the existing business.
   */
  const business =
    await prisma.business.findFirst();

  if (!business) {
    throw new Error(
      'No business found in the database.',
    );
  }

  console.log(
    `Using business: ${business.name}`,
  );

  console.log(
    `Business ID: ${business.id}`,
  );

  /*
   * Sample Glow Salon knowledge.
   */
  const knowledge = [
    {
      title:
        'Glow Salon Services and Prices',

      category: 'services',

      content: `
Glow Salon offers the following services:

Haircut - PKR 2,000
Hair Styling - PKR 1,500
Hair Coloring - PKR 5,000
Hair Highlights - PKR 6,500
Keratin Treatment - PKR 8,000
Facial - PKR 3,000
Deep Cleansing Facial - PKR 3,500
Manicure - PKR 1,500
Pedicure - PKR 2,000
Manicure and Pedicure Combo - PKR 3,000
Bridal Makeup - PKR 15,000
Party Makeup - PKR 7,000

Prices may vary depending on hair length,
treatment complexity, or additional products required.
      `.trim(),
    },

    {
      title:
        'Glow Salon Opening Hours',

      category: 'hours',

      content: `
Glow Salon opening hours:

Monday: 10:00 AM - 8:00 PM
Tuesday: 10:00 AM - 8:00 PM
Wednesday: 10:00 AM - 8:00 PM
Thursday: 10:00 AM - 8:00 PM
Friday: 10:00 AM - 9:00 PM
Saturday: 10:00 AM - 9:00 PM
Sunday: 11:00 AM - 6:00 PM
      `.trim(),
    },

    {
      title:
        'Glow Salon Location',

      category: 'location',

      content: `
Glow Salon is located at:

Glow Salon
123 Main Boulevard
Bahria Town
Rawalpindi, Pakistan

Customers can contact the salon reception
for directions or additional location information.
      `.trim(),
    },

    {
      title:
        'Glow Salon Booking Policy',

      category: 'booking',

      content: `
Customers can book available appointment slots
through the salon receptionist.

Customers should provide their full name and
email address when booking.

An appointment is only considered confirmed after
the booking system successfully creates the appointment.

Customers should keep their booking ID because it
is required when requesting a cancellation.
      `.trim(),
    },

    {
      title:
        'Glow Salon Cancellation Policy',

      category: 'cancellation',

      content: `
Customers can cancel an existing appointment
using their booking ID.

The receptionist should never invent a booking ID.

If a booking cannot be found, the customer should
be informed that the booking ID could not be located.

Cancelled appointment slots become available again
for other customers.
      `.trim(),
    },

    {
      title:
        'Glow Salon General Information',

      category: 'general',

      content: `
Glow Salon is a full-service salon offering hair care,
beauty treatments, makeup, manicure and pedicure services.

The salon aims to provide friendly and professional
beauty services in a comfortable environment.

Customers can ask the receptionist about services,
prices, opening hours, location, appointment availability,
booking, and cancellation.
      `.trim(),
    },
  ];

  /*
   * Remove previous knowledge.
   */
  console.log(
    'Removing previous knowledge...',
  );

  await prisma.knowledgeDocument.deleteMany({
    where: {
      businessId: business.id,
    },
  });

  console.log(
    'Previous knowledge removed.',
  );

  /*
   * Create new knowledge documents.
   */
  for (const item of knowledge) {
    console.log(
      `Creating: ${item.title}`,
    );

    /*
     * Generate embedding locally.
     *
     * No OpenAI API is used.
     */
    const embedding =
      await createEmbedding(
        item.content,
      );

    /*
     * Create knowledge document.
     */
    const document =
      await prisma.knowledgeDocument.create({
        data: {
          businessId:
            business.id,

          title:
            item.title,

          category:
            item.category,
        },
      });

    /*
     * Convert embedding to PostgreSQL
     * vector format.
     */
    const vector =
      `[${embedding.join(',')}]`;

    /*
     * Insert knowledge chunk.
     */
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "KnowledgeChunk"
        ("id", "documentId", "content", "embedding")
      VALUES
        (gen_random_uuid(), $1, $2, $3::vector)
      `,
      document.id,
      item.content,
      vector,
    );

    console.log(
      `Created: ${item.title}`,
    );
  }

  console.log('');
  console.log(
    '======================================',
  );
  console.log(
    'Knowledge seeded successfully!',
  );
  console.log(
    '======================================',
  );
}

main()
  .catch((error) => {
    console.error('');
    console.error(
      'Knowledge seed failed:',
    );
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
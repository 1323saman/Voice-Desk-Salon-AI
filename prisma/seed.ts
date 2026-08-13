import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pipeline } from '@xenova/transformers';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function createEmbedding(
  extractor: any,
  text: string,
): Promise<number[]> {
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding = Array.from(output.data) as number[];

  if (embedding.length !== 384) {
    throw new Error(
      `Invalid embedding dimension: ${embedding.length}`,
    );
  }

  return embedding;
}

async function main() {
  console.log('Starting database seed...');

  /*
   * Clear old test data.
   *
   * Knowledge documents must be deleted before
   * businesses because of the foreign key.
   */
  await prisma.booking.deleteMany();
  await prisma.message.deleteMany();
  await prisma.session.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.client.deleteMany();
  await prisma.knowledgeChunk.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.business.deleteMany();

  /*
   * Create Glow Salon.
   */
  const business = await prisma.business.create({
    data: {
      name: 'Glow Salon',
      email: 'owner@glowsalon.com',
      apiKey: 'test-api-key-123',
    },
  });

  console.log(`Created business: ${business.name}`);

  /*
   * Create future appointment slots.
   *
   * First slot = 10 minutes from now.
   * Each appointment = 30 minutes.
   * 10-minute gap between appointments.
   */
  const now = new Date();

  const slots: {
    businessId: string;
    startTime: Date;
    endTime: Date;
    isBooked: boolean;
  }[] = [];

  for (let i = 0; i < 5; i++) {
    const start = new Date(
      now.getTime() +
        (10 + i * 40) * 60 * 1000,
    );

    const end = new Date(
      start.getTime() + 30 * 60 * 1000,
    );

    slots.push({
      businessId: business.id,
      startTime: start,
      endTime: end,
      isBooked: false,
    });
  }

  await prisma.slot.createMany({
    data: slots,
  });

  /*
   * Load local embedding model.
   */
  console.log('');
  console.log(
    'Loading embedding model: Xenova/all-MiniLM-L6-v2...',
  );

  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
  );

  console.log('Embedding model loaded.');

  /*
   * Glow Salon knowledge base.
   *
   * These are the documents RAG will search.
   */
  const knowledge = [
    {
      title: 'Glow Salon Services and Prices',
      category: 'services',
      content: `
Glow Salon offers the following services:

Haircut: $30
Hair Coloring: $80
Highlights: $100
Blow Dry: $35
Hair Styling: $50
Manicure: $25
Pedicure: $35
Facial: $60
Bridal Makeup: $150

Customers can ask the Glow Salon AI Front Desk about services and prices.
      `.trim(),
    },

    {
      title: 'Glow Salon Opening Hours',
      category: 'hours',
      content: `
Glow Salon opening hours:

Monday to Thursday: 10:00 AM to 8:00 PM.
Friday and Saturday: 10:00 AM to 9:00 PM.
Sunday: 11:00 AM to 6:00 PM.

The salon is closed outside these opening hours.
      `.trim(),
    },

    {
      title: 'Glow Salon Appointment Policy',
      category: 'appointments',
      content: `
Glow Salon accepts appointments through the AI Front Desk.

Customers can request available appointment slots.

To book an appointment, the customer must provide:
- Full name
- Email address
- Desired appointment time or request for the next available appointment

The AI Front Desk checks the actual database availability before booking.

A booking generates a unique Booking ID.

Customers should keep their Booking ID because it is required to cancel an appointment.
      `.trim(),
    },

    {
      title: 'Glow Salon Cancellation Policy',
      category: 'cancellation',
      content: `
Glow Salon appointments can be cancelled using the Booking ID.

The customer must provide the Booking ID for the appointment they want to cancel.

After a successful cancellation:
- The booking status becomes cancelled.
- The appointment slot becomes available again.
- A cancellation email is sent to the customer's email address.
      `.trim(),
    },

    {
      title: 'Glow Salon Location and Contact',
      category: 'location',
      content: `
Glow Salon is a professional salon.

For appointment questions, customers can use the Glow Salon AI Front Desk.

The salon email address is owner@glowsalon.com.
      `.trim(),
    },
  ];

  /*
   * Create documents and chunks with embeddings.
   */
  console.log('');
  console.log('Creating RAG knowledge base...');

  for (const document of knowledge) {
    const createdDocument =
      await prisma.knowledgeDocument.create({
        data: {
          businessId: business.id,
          title: document.title,
          category: document.category,
        },
      });

    const embedding =
      await createEmbedding(
        extractor,
        document.content,
      );

    /*
     * PostgreSQL pgvector literal.
     */
    const vector =
      `[${embedding.join(',')}]`;

    /*
     * Prisma does not support Unsupported vector
     * fields directly through normal create().
     *
     * Therefore insert the KnowledgeChunk using
     * raw SQL.
     */
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "KnowledgeChunk"
        ("id", "documentId", "content", "embedding")
      VALUES
        (gen_random_uuid(), $1, $2, $3::vector)
      `,
      createdDocument.id,
      document.content,
      vector,
    );

    console.log(
      `Added knowledge: ${document.title}`,
    );
  }

  console.log('');
  console.log('======================================');
  console.log('DATABASE SEEDED SUCCESSFULLY');
  console.log('======================================');
  console.log('');
  console.log(`Business: ${business.name}`);
  console.log(`Business ID: ${business.id}`);
  console.log('');
  console.log('AVAILABLE SLOTS:');

  slots.forEach((slot, index) => {
    console.log(
      `${index + 1}. ${slot.startTime.toLocaleString()} - ${slot.endTime.toLocaleString()}`,
    );
  });

  console.log('');
  console.log(
    `Knowledge documents created: ${knowledge.length}`,
  );

  console.log('');
  console.log(
    'RAG knowledge base is ready.',
  );
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(
      'Seed failed:',
      error,
    );

    await prisma.$disconnect();

    process.exit(1);
  });
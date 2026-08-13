import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not configured in the environment.',
      );
    }

    const adapter = new PrismaPg({
      connectionString,
    });

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
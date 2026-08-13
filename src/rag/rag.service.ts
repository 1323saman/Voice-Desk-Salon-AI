
import { Injectable } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RagService {
  private extractor: any;
  private extractorPromise: Promise<any> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load the local embedding model only once.
   *
   * Model:
   * Xenova/all-MiniLM-L6-v2
   *
   * Output dimension:
   * 384
   */
  private async getExtractor(): Promise<any> {
    if (this.extractor) {
      return this.extractor;
    }

    if (!this.extractorPromise) {
      console.log('Loading local embedding model...');

      this.extractorPromise = pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );
    }

    this.extractor = await this.extractorPromise;

    console.log('Local embedding model loaded.');

    return this.extractor;
  }

  /**
   * Generate a 384-dimensional embedding locally.
   *
   * No OpenAI API is used.
   */
  private async createEmbedding(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();

    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data) as number[];

    if (embedding.length !== 384) {
      throw new Error(
        `Invalid embedding dimension: ${embedding.length}. Expected 384.`,
      );
    }

    return embedding;
  }

  /**
   * Search the business knowledge base.
   */
  async search(
    businessId: string,
    query: string,
    limit = 5,
  ): Promise<string> {
    try {
      if (!query?.trim()) {
        return '';
      }

      /**
       * Generate the query embedding locally.
       */
      const embedding = await this.createEmbedding(query);

      /**
       * Convert embedding to PostgreSQL pgvector format.
       */
      const vector = `[${embedding.join(',')}]`;

      /**
       * Search using cosine distance.
       *
       * <=> is the pgvector cosine-distance operator.
       *
       * Lower distance = more relevant result.
       */
      const chunks = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          content: string;
          title: string;
          category: string;
          distance: number;
        }>
      >(
        `
        SELECT
          kc."id",
          kc."content",
          kd."title",
          kd."category",
          kc."embedding" <=> $1::vector AS distance
        FROM "KnowledgeChunk" kc
        JOIN "KnowledgeDocument" kd
          ON kd."id" = kc."documentId"
        WHERE kd."businessId" = $2
          AND kc."embedding" IS NOT NULL
        ORDER BY kc."embedding" <=> $1::vector
        LIMIT $3
        `,
        vector,
        businessId,
        limit,
      );

      if (chunks.length === 0) {
        return '';
      }

      /**
       * Build the knowledge context sent to the AI.
       */
      return chunks
        .map(
          (chunk) =>
            `[${chunk.category}] ${chunk.title}\n${chunk.content}`,
        )
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('RAG search error:', error);

      return '';
    }
  }
}

-- This is an empty migration.CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_businessId_idx"
ON "KnowledgeDocument"("businessId");

CREATE INDEX "KnowledgeDocument_category_idx"
ON "KnowledgeDocument"("category");

CREATE INDEX "KnowledgeChunk_documentId_idx"
ON "KnowledgeChunk"("documentId");

ALTER TABLE "KnowledgeDocument"
ADD CONSTRAINT "KnowledgeDocument_businessId_fkey"
FOREIGN KEY ("businessId")
REFERENCES "Business"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
FOREIGN KEY ("documentId")
REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
/**
 * Embedding Service
 *
 * Generates text embeddings using Gemini text-embedding-004 (768 dimensions)
 * and stores/queries them via pgvector in PostgreSQL.
 */

import { toSql } from 'pgvector'
import { GoogleGenAI } from '@google/genai'
import { rawPrisma } from '@/lib/db'

// Lazy initialization flag — avoid re-running extension/index creation
let pgvectorInitialized = false

/**
 * Ensure pgvector extension and HNSW indexes exist.
 * Idempotent — safe to call multiple times.
 */
export async function ensurePgvector(): Promise<void> {
  if (pgvectorInitialized) return

  try {
    await rawPrisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector')

    // HNSW indexes for cosine similarity on all embedding columns
    const indexDefs = [
      `CREATE INDEX IF NOT EXISTS idx_ticket_embedding ON "Ticket" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
      `CREATE INDEX IF NOT EXISTS idx_calendar_event_embedding ON "CalendarEvent" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_item_embedding ON "InventoryItem" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
      `CREATE INDEX IF NOT EXISTS idx_conversation_message_embedding ON "ConversationMessage" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
      `CREATE INDEX IF NOT EXISTS idx_user_memory_fact_embedding ON "UserMemoryFact" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
    ]

    for (const sql of indexDefs) {
      try {
        await rawPrisma.$executeRawUnsafe(sql)
      } catch (indexErr) {
        // Index creation failure is non-fatal (e.g., table not yet created)
        console.warn('[embeddingService] Index creation warning:', indexErr)
      }
    }

    pgvectorInitialized = true
  } catch (err) {
    console.error('[embeddingService] pgvector setup error:', err)
    // Don't re-throw — graceful degradation if vector extension unavailable
  }
}

/**
 * Generate a 768-dimension embedding vector from text using Gemini.
 * Returns empty array if GEMINI_API_KEY is not configured.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) {
    return []
  }

  // Truncate input text to 2048 chars max (API safety limit)
  const truncated = text.slice(0, 2048)

  try {
    const client = new GoogleGenAI({ apiKey })
    const result = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: truncated,
      config: { outputDimensionality: 768 },
    })

    return result.embeddings?.[0]?.values ?? []
  } catch (err) {
    console.error('[embeddingService] generateEmbedding error:', err)
    return []
  }
}

/**
 * Store an embedding vector for a record using raw SQL.
 * Uses pgvector toSql() for proper vector serialization.
 */
export async function storeEmbedding(
  tableName: string,
  recordId: string,
  embedding: number[]
): Promise<void> {
  if (embedding.length === 0) return

  await ensurePgvector()

  const vectorSql = toSql(embedding)
  await rawPrisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET embedding = $1::vector WHERE id = $2`,
    vectorSql,
    recordId
  )
}

/**
 * Search for similar records using cosine similarity.
 * Returns records ordered by similarity descending.
 */
export async function searchSimilar(
  tableName: string,
  queryEmbedding: number[],
  opts: {
    limit?: number
    orgId?: string
    filters?: string
  } = {}
): Promise<Array<{ id: string; similarity: number }>> {
  if (queryEmbedding.length === 0) return []

  await ensurePgvector()

  const limit = opts.limit ?? 10
  const vectorSql = toSql(queryEmbedding)

  const params: unknown[] = [vectorSql]
  let paramIndex = 2

  let sql = `
    SELECT id, 1 - (embedding <=> $1::vector) AS similarity
    FROM "${tableName}"
    WHERE embedding IS NOT NULL
  `

  if (opts.orgId) {
    sql += ` AND "organizationId" = $${paramIndex}`
    params.push(opts.orgId)
    paramIndex++
  }

  if (opts.filters) {
    sql += ` AND ${opts.filters}`
  }

  sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`
  params.push(limit)

  const rows = await rawPrisma.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
    sql,
    ...params
  )

  return rows
}

/**
 * Convenience function: generate embedding from text and store it.
 * Skips silently if text is empty or API key is missing.
 */
export async function generateAndStoreEmbedding(
  tableName: string,
  recordId: string,
  text: string
): Promise<void> {
  if (!text.trim()) return

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) return

  const embedding = await generateEmbedding(text)
  if (embedding.length === 0) return

  await storeEmbedding(tableName, recordId, embedding)
}

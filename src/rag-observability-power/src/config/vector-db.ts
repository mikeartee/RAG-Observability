/**
 * Vector Database Configuration
 *
 * Configures the vector database client for storing and searching error embeddings.
 * Supports Pinecone as the primary vector database.
 */

export interface VectorDBConfig {
  provider: "pinecone" | "chroma" | "memory";
  apiKey?: string;
  environment?: string;
  indexName: string;
  dimension: number;
  metric: "cosine" | "euclidean" | "dotproduct";
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: Record<string, string | number | boolean>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, string | number | boolean>;
}

export interface VectorDBClient {
  // Upsert vectors
  upsert(records: VectorRecord[]): Promise<void>;

  // Search for similar vectors
  search(
    vector: number[],
    topK: number,
    filter?: Record<string, string | number | boolean>
  ): Promise<VectorSearchResult[]>;

  // Delete vectors by ID
  delete(ids: string[]): Promise<void>;

  // Get vector by ID
  fetch(ids: string[]): Promise<VectorRecord[]>;
}

// Default configuration for development/testing
export const defaultVectorDBConfig: VectorDBConfig = {
  provider: "memory",
  indexName: "rag-observability-errors",
  dimension: 1536, // OpenAI embedding dimension
  metric: "cosine",
};

/**
 * In-memory vector database implementation for testing
 */
export class InMemoryVectorDB implements VectorDBClient {
  private records: Map<string, VectorRecord> = new Map();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, string | number | boolean>
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const record of this.records.values()) {
      // Apply filter if provided
      if (filter) {
        let matches = true;
        for (const [key, value] of Object.entries(filter)) {
          if (record.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(vector, record.values);
      results.push({
        id: record.id,
        score,
        metadata: record.metadata,
      });
    }

    // Sort by score descending and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.records.delete(id);
    }
  }

  async fetch(ids: string[]): Promise<VectorRecord[]> {
    const results: VectorRecord[] = [];
    for (const id of ids) {
      const record = this.records.get(id);
      if (record) {
        results.push(record);
      }
    }
    return results;
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  // Helper method for testing
  clear(): void {
    this.records.clear();
  }

  // Helper method for testing
  size(): number {
    return this.records.size;
  }
}

/**
 * Create a vector database client based on configuration
 */
export function createVectorDBClient(config: VectorDBConfig): VectorDBClient {
  switch (config.provider) {
    case "memory":
      return new InMemoryVectorDB();
    case "pinecone":
      // Pinecone client would be initialized here with actual SDK
      // For now, fall back to in-memory for development
      console.warn("Pinecone client not configured, using in-memory fallback");
      return new InMemoryVectorDB();
    case "chroma":
      // Chroma client would be initialized here
      console.warn("Chroma client not configured, using in-memory fallback");
      return new InMemoryVectorDB();
    default:
      return new InMemoryVectorDB();
  }
}

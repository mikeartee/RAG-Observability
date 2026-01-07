/**
 * Configuration exports
 */

export {
  createVectorDBClient,
  defaultVectorDBConfig,
  InMemoryVectorDB,
} from "./vector-db.js";

export type {
  VectorDBClient,
  VectorDBConfig,
  VectorRecord,
  VectorSearchResult,
} from "./vector-db.js";

/**
 * Error Knowledge Base Module
 *
 * Exports the ErrorKnowledgeBase implementation and related utilities.
 */

export {
  ErrorKnowledgeBaseImpl,
  createErrorRecord,
  createFixRecord,
} from "./error-knowledge-base.js";
export type { ErrorKnowledgeBaseConfig } from "./error-knowledge-base.js";

export { InMemoryErrorStore } from "./error-store.js";
export type { ErrorStore } from "./error-store.js";


/**
 * RAG Observability Power
 *
 * A Kiro POWER for RAG system observability and self-improvement.
 * Answers three critical questions when RAG failures occur:
 * - Where did it break?
 * - Why did it break?
 * - How do we fix it?
 */

// Export all types
export * from "./types/index.js";

// Export configuration
export * from "./config/index.js";

// Export RAG Monitor
export { InMemoryQueryStore, RAGMonitorImpl } from "./rag-monitor/index.js";
export type { QueryStore } from "./rag-monitor/index.js";

// Export Drift Detector
export { DriftDetectorImpl } from "./drift-detector/index.js";

// Export Code Correlator
export { CodeCorrelatorImpl, DefaultGitExecutor } from "./code-correlator/index.js";
export type { GitExecutor } from "./code-correlator/index.js";

// Export Failure Capturer
export { FailureCapturerImpl, InMemoryFailureStore } from "./failure-capturer/index.js";
export type { FailureCapturerConfig, FailureStore } from "./failure-capturer/index.js";

// Export Error Knowledge Base
export {
  ErrorKnowledgeBaseImpl,
  InMemoryErrorStore,
  createErrorRecord,
  createFixRecord,
} from "./error-knowledge-base/index.js";
export type { ErrorKnowledgeBaseConfig, ErrorStore } from "./error-knowledge-base/index.js";

// Export Fix Suggester
export { FixSuggesterImpl } from "./fix-suggester/index.js";
export type { FixSuggesterConfig } from "./fix-suggester/index.js";

// Export Self-Improvement Loop
export { SelfImprovementLoopImpl } from "./self-improvement/index.js";
export type { SelfImprovementLoopConfig } from "./self-improvement/index.js";

// Export Dashboard Data Provider
export { DashboardDataProviderImpl } from "./dashboard/index.js";
export type { DashboardDataProviderConfig } from "./dashboard/index.js";

// Export main Power entry point
export {
  RAGObservabilityPower,
  createRAGObservabilityPower,
} from "./power.js";
export type { RAGObservabilityPowerConfig } from "./power.js";

// Export MCP tools for Kiro integration
export {
  getMCPTools,
  MCPToolHandler,
  createMCPToolHandler,
} from "./mcp-tools.js";
export type { MCPTool } from "./mcp-tools.js";

// Version information
export const VERSION = "1.0.0";
export const POWER_NAME = "rag-observability-power";

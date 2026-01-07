/**
 * Main RAG Observability Power entry point
 *
 * Initializes all components with shared configuration and wires them together.
 */

import { RAGMonitorImpl, InMemoryQueryStore } from "./rag-monitor/index.js";
import { DriftDetectorImpl } from "./drift-detector/index.js";
import { CodeCorrelatorImpl, DefaultGitExecutor } from "./code-correlator/index.js";
import { FailureCapturerImpl, InMemoryFailureStore } from "./failure-capturer/index.js";
import {
  ErrorKnowledgeBaseImpl,
  InMemoryErrorStore,
} from "./error-knowledge-base/index.js";
import { FixSuggesterImpl } from "./fix-suggester/index.js";
import { SelfImprovementLoopImpl } from "./self-improvement/index.js";
import { DashboardDataProviderImpl } from "./dashboard/index.js";
import {
  createVectorDBClient,
  defaultVectorDBConfig,
  InMemoryVectorDB,
} from "./config/index.js";

import type { RAGMonitor } from "./types/rag-monitor.js";
import type { DriftDetector } from "./types/drift-detector.js";
import type { CodeCorrelator } from "./types/code-correlator.js";
import type { FailureCapturer } from "./types/failure-capturer.js";
import type { ErrorKnowledgeBase } from "./types/error-knowledge-base.js";
import type { FixSuggester } from "./types/fix-suggester.js";
import type { SelfImprovementLoop } from "./types/self-improvement.js";
import type { DashboardDataProvider } from "./types/dashboard.js";
import type { VectorDBClient, VectorDBConfig } from "./config/vector-db.js";
import type { RAGQueryEvent } from "./types/rag-monitor.js";
import type { CodingContext } from "./types/core.js";
import type { RelevantError } from "./types/self-improvement.js";
import type { FixSuggestion } from "./types/fix-suggester.js";
import type { DriftAlert } from "./types/drift-detector.js";

/**
 * Configuration for the RAG Observability Power
 */
export interface RAGObservabilityPowerConfig {
  /**
   * Repository path for code correlation
   */
  repoPath: string;

  /**
   * Vector database configuration
   * If not provided, uses in-memory vector DB
   */
  vectorDB?: VectorDBConfig;

  /**
   * Control limits configuration for drift detection
   */
  controlLimits?: {
    successRateLower: number;
    relevanceScoreLower: number;
    latencyUpper: number;
    sigma: number;
  };

  /**
   * Threshold for steering rule generation
   * Number of successful fixes before auto-generating a rule
   */
  steeringRuleThreshold?: number;

  /**
   * Enable automatic drift detection
   */
  enableAutoDriftDetection?: boolean;

  /**
   * Drift detection interval in milliseconds
   */
  driftDetectionIntervalMs?: number;
}

/**
 * Main RAG Observability Power class
 *
 * Coordinates all components and provides a unified interface for RAG observability.
 */
export class RAGObservabilityPower {
  private ragMonitor: RAGMonitor;
  private driftDetector: DriftDetector;
  private codeCorrelator: CodeCorrelator;
  private failureCapturer: FailureCapturer;
  private errorKnowledgeBase: ErrorKnowledgeBase;
  private fixSuggester: FixSuggester;
  private selfImprovementLoop: SelfImprovementLoop;
  private dashboardDataProvider: DashboardDataProvider;
  private vectorDB: VectorDBClient;
  private config: RAGObservabilityPowerConfig;
  private driftDetectionInterval?: NodeJS.Timeout;

  constructor(config: RAGObservabilityPowerConfig) {
    this.config = config;

    // Initialize vector DB
    if (config.vectorDB) {
      this.vectorDB = createVectorDBClient(config.vectorDB);
    } else {
      // Use in-memory vector DB for development/testing
      this.vectorDB = new InMemoryVectorDB();
    }

    // Initialize storage layers
    const queryStore = new InMemoryQueryStore();
    const failureStore = new InMemoryFailureStore();
    const errorStore = new InMemoryErrorStore();

    // Initialize core components
    this.ragMonitor = new RAGMonitorImpl({ queryStore });
    this.driftDetector = new DriftDetectorImpl();
    this.codeCorrelator = new CodeCorrelatorImpl(
      new DefaultGitExecutor(config.repoPath)
    );
    this.failureCapturer = new FailureCapturerImpl({ failureStore });
    this.errorKnowledgeBase = new ErrorKnowledgeBaseImpl({
      errorStore,
      vectorDB: this.vectorDB,
    });
    this.fixSuggester = new FixSuggesterImpl({ knowledgeBase: this.errorKnowledgeBase });
    this.selfImprovementLoop = new SelfImprovementLoopImpl({
      knowledgeBase: this.errorKnowledgeBase,
      steeringRuleThreshold: config.steeringRuleThreshold || 3,
    });
    this.dashboardDataProvider = new DashboardDataProviderImpl({
      ragMonitor: this.ragMonitor,
      driftDetector: this.driftDetector,
      codeCorrelator: this.codeCorrelator,
      failureCapturer: this.failureCapturer,
      errorKnowledgeBase: this.errorKnowledgeBase,
      fixSuggester: this.fixSuggester,
    });

    // Set up event listeners
    this.setupEventListeners();

    // Start automatic drift detection if enabled
    if (config.enableAutoDriftDetection) {
      this.startAutoDriftDetection(
        config.driftDetectionIntervalMs || 60000 // Default: 1 minute
      );
    }
  }

  /**
   * Set up event listeners between components
   */
  private setupEventListeners(): void {
    // When a query is logged, check if it's a failure and capture it
    // This is a simplified event system - in production, use a proper event emitter
    const originalLogQuery = this.ragMonitor.logQuery.bind(this.ragMonitor);
    this.ragMonitor.logQuery = async (event: RAGQueryEvent): Promise<void> => {
      await originalLogQuery(event);

      // If query failed, capture the failure
      if (!event.success) {
        await this.failureCapturer.captureFailure(event);

        // Store error in knowledge base if error details exist
        if (event.errorDetails) {
          const errorRecord = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: event.timestamp,
            type: event.errorDetails.type,
            component: event.errorDetails.component || "unknown",
            severity: event.errorDetails.severity || "medium",
            context: {
              query: event.query,
              retrievedDocs: event.retrievedDocuments.map((doc) => doc.content),
              generationOutput: event.generationOutput,
              stackTrace: event.errorDetails.stackTrace,
              breadcrumbs: event.errorDetails.breadcrumbs || [],
            },
            embedding: [], // Will be generated by ErrorKnowledgeBase
            fixes: [],
          };

          await this.errorKnowledgeBase.storeError(errorRecord);
        }
      }
    };
  }

  /**
   * Start automatic drift detection
   */
  private startAutoDriftDetection(intervalMs: number): void {
    this.driftDetectionInterval = setInterval(async () => {
      try {
        const statistics = await this.ragMonitor.getStatistics({
          start: new Date(Date.now() - 3600000), // Last hour
          end: new Date(),
          granularity: "minute",
        });

        const baseline = await this.ragMonitor.getBaseline();
        const driftResult = this.driftDetector.checkForDrift(
          statistics,
          baseline
        );

        if (driftResult.hasDrift) {
          console.log(
            `[RAG Observability] Drift detected: ${driftResult.message}`
          );
          // In production, this would trigger alerts/notifications
        }
      } catch (error) {
        console.error("[RAG Observability] Drift detection error:", error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic drift detection
   */
  private stopAutoDriftDetection(): void {
    if (this.driftDetectionInterval) {
      clearInterval(this.driftDetectionInterval);
      this.driftDetectionInterval = undefined;
    }
  }

  /**
   * Log a RAG query event
   */
  async logQuery(event: RAGQueryEvent): Promise<void> {
    return this.ragMonitor.logQuery(event);
  }

  /**
   * Get relevant errors for current coding context
   */
  async getRelevantErrors(context: CodingContext): Promise<RelevantError[]> {
    return this.selfImprovementLoop.getRelevantErrors(context);
  }

  /**
   * Get fix suggestions for an error
   */
  async suggestFixes(errorId: string): Promise<FixSuggestion[]> {
    const error = await this.errorKnowledgeBase.getError(errorId);
    return this.fixSuggester.suggestFixes(error);
  }

  /**
   * Get active drift alerts
   */
  async getActiveDriftAlerts(): Promise<DriftAlert[]> {
    return this.driftDetector.getActiveAlerts();
  }

  /**
   * Get dashboard data provider for UI integration
   */
  getDashboardDataProvider(): DashboardDataProvider {
    return this.dashboardDataProvider;
  }

  /**
   * Get individual components for advanced usage
   */
  getComponents() {
    return {
      ragMonitor: this.ragMonitor,
      driftDetector: this.driftDetector,
      codeCorrelator: this.codeCorrelator,
      failureCapturer: this.failureCapturer,
      errorKnowledgeBase: this.errorKnowledgeBase,
      fixSuggester: this.fixSuggester,
      selfImprovementLoop: this.selfImprovementLoop,
      dashboardDataProvider: this.dashboardDataProvider,
    };
  }

  /**
   * Shutdown the power and clean up resources
   */
  async shutdown(): Promise<void> {
    this.stopAutoDriftDetection();
    // Additional cleanup if needed
  }
}

/**
 * Create a RAG Observability Power instance with default configuration
 */
export function createRAGObservabilityPower(
  config: RAGObservabilityPowerConfig
): RAGObservabilityPower {
  return new RAGObservabilityPower(config);
}


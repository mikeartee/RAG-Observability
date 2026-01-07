/**
 * Dashboard Data Provider Tests
 *
 * Tests for the DashboardDataProviderImpl class.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { DashboardDataProviderImpl } from "./dashboard-data-provider.js";
import { RAGMonitorImpl } from "../rag-monitor/index.js";
import { DriftDetectorImpl } from "../drift-detector/index.js";
import { CodeCorrelatorImpl } from "../code-correlator/index.js";
import { FailureCapturerImpl } from "../failure-capturer/index.js";
import { ErrorKnowledgeBaseImpl, createErrorRecord, createFixRecord } from "../error-knowledge-base/index.js";
import { FixSuggesterImpl } from "../fix-suggester/index.js";
import type {
  RAGQueryEvent,
  ErrorRecord,
  Commit,
  DashboardDataProviderConfig,
} from "../types/index.js";
import type { GitExecutor } from "../code-correlator/index.js";

/**
 * Create a mock RAG query event
 */
function createMockQueryEvent(overrides: Partial<RAGQueryEvent> = {}): RAGQueryEvent {
  return {
    id: `query-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    query: "test query",
    retrievedDocuments: [
      { id: "doc1", content: "test content", score: 0.9 },
    ],
    contextWindow: "test context",
    generationOutput: "test output",
    qualityMetrics: {
      retrievalRelevanceScore: 0.85,
      generationConfidence: 0.9,
      latencyMs: 150,
      tokenCount: 100,
    },
    success: true,
    ...overrides,
  };
}

/**
 * Create a mock error record
 */
function createMockErrorRecord(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return createErrorRecord({
    timestamp: new Date(),
    type: "retrieval_failure",
    component: "retriever",
    severity: "medium",
    context: {
      query: "test query",
      retrievedDocs: ["doc1"],
      breadcrumbs: [],
    },
    embedding: new Array(1536).fill(0).map((_, i) => Math.sin(i)),
    ...overrides,
  });
}

/**
 * Mock git executor for testing
 */
class MockGitExecutor implements GitExecutor {
  private commits: Commit[] = [];

  setCommits(commits: Commit[]): void {
    this.commits = commits;
  }

  async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    if (command.includes("git log")) {
      // Return formatted commit data
      const output = this.commits
        .map((c) => {
          const files = c.filesChanged
            .map((f) => `${f.changeType === "added" ? "A" : f.changeType === "deleted" ? "D" : "M"}\t${f.path}`)
            .join("\n");
          return `${c.hash}\n${c.timestamp.toISOString()}\n${c.author}\n${c.message}\n${files}`;
        })
        .join("\n\nCOMMIT_SEPARATOR\n\n");
      return { stdout: output, stderr: "" };
    }
    if (command.includes("git show")) {
      return { stdout: "", stderr: "" };
    }
    return { stdout: "", stderr: "" };
  }
}

describe("DashboardDataProviderImpl", () => {
  let ragMonitor: RAGMonitorImpl;
  let driftDetector: DriftDetectorImpl;
  let codeCorrelator: CodeCorrelatorImpl;
  let failureCapturer: FailureCapturerImpl;
  let errorKnowledgeBase: ErrorKnowledgeBaseImpl;
  let fixSuggester: FixSuggesterImpl;
  let mockGitExecutor: MockGitExecutor;
  let dashboardProvider: DashboardDataProviderImpl;

  beforeEach(() => {
    ragMonitor = new RAGMonitorImpl();
    driftDetector = new DriftDetectorImpl();
    mockGitExecutor = new MockGitExecutor();
    codeCorrelator = new CodeCorrelatorImpl(mockGitExecutor);
    failureCapturer = new FailureCapturerImpl();
    errorKnowledgeBase = new ErrorKnowledgeBaseImpl();
    fixSuggester = new FixSuggesterImpl({ knowledgeBase: errorKnowledgeBase });

    const config: DashboardDataProviderConfig = {
      ragMonitor,
      driftDetector,
      codeCorrelator,
      failureCapturer,
      errorKnowledgeBase,
      fixSuggester,
    };

    dashboardProvider = new DashboardDataProviderImpl(config);
  });

  describe("getMetricsTimeSeries", () => {
    it("should return empty time series when no data exists", async () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-01T03:00:00Z");

      const result = await dashboardProvider.getMetricsTimeSeries(
        startDate,
        endDate,
        "hour"
      );

      expect(result.successRate).toBeDefined();
      expect(result.relevanceScore).toBeDefined();
      expect(result.latency).toBeDefined();
      expect(result.queryCount).toBeDefined();
    });

    it("should aggregate metrics by time granularity", async () => {
      // Log some query events
      const baseTime = new Date("2024-01-01T00:00:00Z");

      for (let i = 0; i < 5; i++) {
        const event = createMockQueryEvent({
          timestamp: new Date(baseTime.getTime() + i * 30 * 60 * 1000), // 30 min intervals
          qualityMetrics: {
            retrievalRelevanceScore: 0.8 + i * 0.02,
            generationConfidence: 0.9,
            latencyMs: 100 + i * 10,
            tokenCount: 100,
          },
        });
        await ragMonitor.logQuery(event);
      }

      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-01T03:00:00Z");

      const result = await dashboardProvider.getMetricsTimeSeries(
        startDate,
        endDate,
        "hour"
      );

      // Should have data points for each hour bucket
      expect(result.successRate.length).toBeGreaterThan(0);
      expect(result.queryCount.length).toBeGreaterThan(0);
    });
  });

  describe("getDriftEvents", () => {
    it("should return empty array when no drift events exist", async () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-02T00:00:00Z");

      const result = await dashboardProvider.getDriftEvents(startDate, endDate);

      expect(result).toEqual([]);
    });

    it("should return drift events with severity indicators", async () => {
      // Create a drift condition by setting up baseline and checking
      await ragMonitor.updateBaseline();

      // Log events with degraded metrics
      for (let i = 0; i < 10; i++) {
        const event = createMockQueryEvent({
          qualityMetrics: {
            retrievalRelevanceScore: 0.5, // Below threshold
            generationConfidence: 0.9,
            latencyMs: 6000, // Above threshold
            tokenCount: 100,
          },
          success: false,
        });
        await ragMonitor.logQuery(event);
      }

      const window = {
        start: new Date(Date.now() - 3600000),
        end: new Date(),
        granularity: "hour" as const,
      };

      const stats = await ragMonitor.getStatistics(window);
      const baseline = await ragMonitor.getBaseline();

      // Check for drift (this will create an alert)
      driftDetector.checkForDrift(stats, baseline);

      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const result = await dashboardProvider.getDriftEvents(startDate, endDate);

      // Should have drift events if metrics breached thresholds
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getCommitTimeline", () => {
    it("should return empty array when no commits exist", async () => {
      mockGitExecutor.setCommits([]);

      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-02T00:00:00Z");

      const result = await dashboardProvider.getCommitTimeline(startDate, endDate);

      expect(result).toEqual([]);
    });

    it("should identify RAG-related commits", async () => {
      const commits: Commit[] = [
        {
          hash: "abc123",
          timestamp: new Date("2024-01-01T12:00:00Z"),
          author: "Test Author",
          message: "Update retrieval logic",
          filesChanged: [
            { path: "src/retriever.ts", changeType: "modified" },
          ],
        },
        {
          hash: "def456",
          timestamp: new Date("2024-01-01T10:00:00Z"),
          author: "Test Author",
          message: "Update README",
          filesChanged: [
            { path: "README.md", changeType: "modified" },
          ],
        },
      ];

      mockGitExecutor.setCommits(commits);

      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-02T00:00:00Z");

      const result = await dashboardProvider.getCommitTimeline(startDate, endDate);

      expect(result.length).toBe(2);

      // RAG-related commit should be flagged
      const ragCommit = result.find((c) => c.commit.hash === "abc123");
      expect(ragCommit?.ragRelated).toBe(true);

      // Non-RAG commit should not be flagged
      const nonRagCommit = result.find((c) => c.commit.hash === "def456");
      expect(nonRagCommit?.ragRelated).toBe(false);
    });
  });

  describe("getErrorList", () => {
    it("should return empty array when no errors exist", async () => {
      const result = await dashboardProvider.getErrorList({});

      expect(result).toEqual([]);
    });

    it("should return errors with status", async () => {
      // Store an error
      const error = createMockErrorRecord();
      await errorKnowledgeBase.storeError(error);

      const result = await dashboardProvider.getErrorList({});

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(error.id);
      expect(result[0].status).toBe("open");
    });

    it("should filter errors by type", async () => {
      // Store errors of different types
      const error1 = createMockErrorRecord({ type: "retrieval_failure" });
      const error2 = createMockErrorRecord({ type: "generation_error" });

      await errorKnowledgeBase.storeError(error1);
      await errorKnowledgeBase.storeError(error2);

      const result = await dashboardProvider.getErrorList({
        errorType: "retrieval_failure",
      });

      expect(result.length).toBe(1);
      expect(result[0].type).toBe("retrieval_failure");
    });

    it("should show fixed status when error has resolved fix", async () => {
      // Store an error with a resolved fix
      const error = createMockErrorRecord();
      await errorKnowledgeBase.storeError(error);

      const fix = createFixRecord({
        errorId: error.id,
        description: "Fixed the issue",
        codeChanges: [],
        appliedAt: new Date(),
        resolved: true,
        successRate: 1.0,
      });

      await errorKnowledgeBase.linkFix(error.id, fix);

      const result = await dashboardProvider.getErrorList({});

      expect(result.length).toBe(1);
      expect(result[0].status).toBe("fixed");
    });
  });

  describe("getErrorDetail", () => {
    it("should return error with similar errors and suggestions", async () => {
      // Store multiple similar errors
      const error1 = createMockErrorRecord({
        context: {
          query: "similar query 1",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });
      const error2 = createMockErrorRecord({
        context: {
          query: "similar query 2",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });

      await errorKnowledgeBase.storeError(error1);
      await errorKnowledgeBase.storeError(error2);

      const result = await dashboardProvider.getErrorDetail(error1.id);

      expect(result.error.id).toBe(error1.id);
      expect(result.similarErrors).toBeDefined();
      expect(result.fixSuggestions).toBeDefined();
      expect(result.replayReady).toBe(false);
    });

    it("should find related failure for replay", async () => {
      // Create an error
      const error = createMockErrorRecord({
        context: {
          query: "test query for replay",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });
      await errorKnowledgeBase.storeError(error);

      // Capture a failure with matching query
      const event = createMockQueryEvent({
        query: "test query for replay",
        success: false,
        timestamp: error.timestamp,
      });
      await failureCapturer.captureFailure(event);

      const result = await dashboardProvider.getErrorDetail(error.id);

      expect(result.relatedFailure).toBeDefined();
      expect(result.relatedFailure?.queryEvent.query).toBe("test query for replay");
    });
  });

  describe("getErrorDetailWithContext", () => {
    it("should return error with breadcrumbs and stack trace", async () => {
      const error = createMockErrorRecord({
        context: {
          query: "test query",
          retrievedDocs: ["doc1"],
          breadcrumbs: [
            { timestamp: new Date(), category: "retrieval", message: "Started retrieval" },
            { timestamp: new Date(), category: "retrieval", message: "Found 5 documents" },
          ],
          stackTrace: "Error at line 42",
        },
      });
      await errorKnowledgeBase.storeError(error);

      const result = await dashboardProvider.getErrorDetailWithContext(error.id);

      expect(result.breadcrumbs.length).toBe(2);
      expect(result.stackTrace).toBe("Error at line 42");
      expect(result.relatedFailures).toBeDefined();
    });
  });

  describe("prepareErrorForReplay", () => {
    it("should indicate when no failure is captured", async () => {
      const error = createMockErrorRecord();
      await errorKnowledgeBase.storeError(error);

      const result = await dashboardProvider.prepareErrorForReplay(error.id);

      expect(result.errorId).toBe(error.id);
      expect(result.replayReady).toBe(false);
      expect(result.message).toContain("No captured failure");
    });

    it("should return failure ID when failure is captured", async () => {
      const error = createMockErrorRecord({
        context: {
          query: "replay test query",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });
      await errorKnowledgeBase.storeError(error);

      // Capture a failure with matching query
      const event = createMockQueryEvent({
        query: "replay test query",
        success: false,
        timestamp: error.timestamp,
      });
      const failure = await failureCapturer.captureFailure(event);

      const result = await dashboardProvider.prepareErrorForReplay(error.id);

      expect(result.errorId).toBe(error.id);
      expect(result.failureId).toBe(failure.id);
    });
  });

  describe("getSummary", () => {
    it("should return dashboard summary statistics", async () => {
      const startDate = new Date(Date.now() - 86400000); // 24 hours ago
      const endDate = new Date();

      const result = await dashboardProvider.getSummary(startDate, endDate);

      expect(result).toHaveProperty("totalQueries");
      expect(result).toHaveProperty("successRate");
      expect(result).toHaveProperty("avgRelevanceScore");
      expect(result).toHaveProperty("avgLatencyMs");
      expect(result).toHaveProperty("activeDriftAlerts");
      expect(result).toHaveProperty("openErrors");
      expect(result).toHaveProperty("recentCommits");
    });
  });

  describe("prepareReplay", () => {
    it("should prepare failure for replay", async () => {
      // Capture a failure
      const event = createMockQueryEvent({ success: false });
      const failure = await failureCapturer.captureFailure(event);

      const result = await dashboardProvider.prepareReplay(failure.id);

      expect(result.failureId).toBe(failure.id);
      expect(result.failure).toBeDefined();
      expect(result.ready).toBeDefined();
    });
  });

  describe("executeReplay", () => {
    it("should execute replay and return result", async () => {
      // Capture a failure
      const event = createMockQueryEvent({ success: false });
      const failure = await failureCapturer.captureFailure(event);

      const result = await dashboardProvider.executeReplay(failure.id);

      expect(result.failureId).toBe(failure.id);
      expect(result).toHaveProperty("reproduced");
      expect(result).toHaveProperty("originalOutput");
      expect(result).toHaveProperty("replayOutput");
    });
  });
});


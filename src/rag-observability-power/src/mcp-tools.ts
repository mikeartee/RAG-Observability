/**
 * MCP (Model Context Protocol) tools for Kiro integration
 *
 * Exposes RAG Observability Power functionality as MCP tools that can be called by Kiro.
 */

import type { RAGObservabilityPower } from "./power.js";
import type { RAGQueryEvent } from "./types/rag-monitor.js";
import type { CodingContext, ErrorType } from "./types/core.js";
import type { TimeWindow } from "./types/core.js";

/**
 * MCP Tool definitions for RAG Observability Power
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Get all MCP tool definitions
 */
export function getMCPTools(): MCPTool[] {
  return [
    {
      name: "rag_log_query",
      description:
        "Log a RAG query event with quality metrics for monitoring and analysis",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The user query",
          },
          retrievedDocuments: {
            type: "array",
            description: "Documents retrieved by the RAG system",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string" },
                score: { type: "number" },
                metadata: { type: "object" },
              },
            },
          },
          generationOutput: {
            type: "string",
            description: "Generated response",
          },
          qualityMetrics: {
            type: "object",
            description: "Quality metrics for the query",
            properties: {
              retrievalRelevanceScore: { type: "number" },
              generationConfidence: { type: "number" },
              latencyMs: { type: "number" },
              tokenCount: { type: "number" },
            },
          },
          success: {
            type: "boolean",
            description: "Whether the query succeeded",
          },
          errorDetails: {
            type: "object",
            description: "Error details if query failed",
          },
        },
        required: ["query", "retrievedDocuments", "generationOutput", "success"],
      },
    },
    {
      name: "rag_get_relevant_errors",
      description:
        "Get relevant past errors for the current coding context to avoid repeating mistakes",
      inputSchema: {
        type: "object",
        properties: {
          currentFile: {
            type: "string",
            description: "Current file being edited",
          },
          recentChanges: {
            type: "array",
            description: "Recent file changes",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                changeType: { type: "string" },
                diff: { type: "string" },
              },
            },
          },
          ragRelatedFiles: {
            type: "array",
            description: "Files related to RAG functionality",
            items: { type: "string" },
          },
          sessionId: {
            type: "string",
            description: "Coding session identifier",
          },
        },
        required: ["currentFile", "sessionId"],
      },
    },
    {
      name: "rag_suggest_fixes",
      description:
        "Get fix suggestions for a specific error based on past similar errors",
      inputSchema: {
        type: "object",
        properties: {
          errorId: {
            type: "string",
            description: "Error ID to get suggestions for",
          },
        },
        required: ["errorId"],
      },
    },
    {
      name: "rag_get_drift_alerts",
      description:
        "Get active drift alerts showing RAG performance degradation",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "rag_get_statistics",
      description: "Get RAG system statistics for a time window",
      inputSchema: {
        type: "object",
        properties: {
          startTime: {
            type: "string",
            description: "Start time (ISO 8601 format)",
          },
          endTime: {
            type: "string",
            description: "End time (ISO 8601 format)",
          },
          granularity: {
            type: "string",
            description: "Time granularity",
            enum: ["minute", "hour", "day", "week"],
          },
        },
        required: ["startTime", "endTime", "granularity"],
      },
    },
    {
      name: "rag_get_recent_failures",
      description: "Get recent RAG failures with full context for debugging",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of failures to return",
          },
          errorType: {
            type: "string",
            description: "Filter by error type",
          },
        },
      },
    },
    {
      name: "rag_replay_failure",
      description:
        "Replay a captured failure to reproduce and debug probabilistic issues",
      inputSchema: {
        type: "object",
        properties: {
          failureId: {
            type: "string",
            description: "Failure ID to replay",
          },
        },
        required: ["failureId"],
      },
    },
    {
      name: "rag_search_similar_errors",
      description: "Search for errors similar to a given query or error",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query or error description",
          },
          errorType: {
            type: "string",
            description: "Filter by error type",
          },
          limit: {
            type: "number",
            description: "Maximum number of results",
          },
        },
        required: ["query"],
      },
    },
  ];
}

/**
 * MCP Tool handler that executes tool calls
 */
export class MCPToolHandler {
  constructor(private power: RAGObservabilityPower) {}

  /**
   * Handle an MCP tool call
   */
  async handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "rag_log_query":
        return this.handleLogQuery(args);

      case "rag_get_relevant_errors":
        return this.handleGetRelevantErrors(args);

      case "rag_suggest_fixes":
        return this.handleSuggestFixes(args);

      case "rag_get_drift_alerts":
        return this.handleGetDriftAlerts();

      case "rag_get_statistics":
        return this.handleGetStatistics(args);

      case "rag_get_recent_failures":
        return this.handleGetRecentFailures(args);

      case "rag_replay_failure":
        return this.handleReplayFailure(args);

      case "rag_search_similar_errors":
        return this.handleSearchSimilarErrors(args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleLogQuery(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; message: string }> {
    const event: RAGQueryEvent = {
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      query: args.query as string,
      retrievedDocuments: args.retrievedDocuments as RAGQueryEvent["retrievedDocuments"],
      contextWindow: "", // Could be derived from retrieved documents
      generationOutput: args.generationOutput as string,
      qualityMetrics: args.qualityMetrics as RAGQueryEvent["qualityMetrics"],
      success: args.success as boolean,
      errorDetails: args.errorDetails as RAGQueryEvent["errorDetails"],
    };

    await this.power.logQuery(event);

    return {
      success: true,
      message: `Query logged with ID: ${event.id}`,
    };
  }

  private async handleGetRelevantErrors(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const context: CodingContext = {
      currentFile: args.currentFile as string,
      recentChanges: (args.recentChanges as CodingContext["recentChanges"]) || [],
      ragRelatedFiles: (args.ragRelatedFiles as string[]) || [],
      sessionId: args.sessionId as string,
    };

    const relevantErrors = await this.power.getRelevantErrors(context);

    return {
      errors: relevantErrors.map((re) => ({
        errorId: re.error.id,
        type: re.error.type,
        severity: re.error.severity,
        relevance: re.relevance,
        warning: re.warning,
        suggestedFix: re.suggestedFix
          ? {
              description: re.suggestedFix.description,
              successRate: re.suggestedFix.successRate,
            }
          : null,
      })),
    };
  }

  private async handleSuggestFixes(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const errorId = args.errorId as string;
    const suggestions = await this.power.suggestFixes(errorId);

    return {
      suggestions: suggestions.map((s) => ({
        id: s.id,
        confidence: s.confidence,
        reasoning: s.reasoning,
        fix: {
          description: s.suggestedFix.description,
          successRate: s.suggestedFix.successRate,
          codeChanges: s.suggestedFix.codeChanges,
        },
        originalError: {
          type: s.originalError.type,
          component: s.originalError.component,
          severity: s.originalError.severity,
        },
      })),
    };
  }

  private async handleGetDriftAlerts(): Promise<unknown> {
    const alerts = await this.power.getActiveDriftAlerts();

    return {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        detectedAt: alert.timestamp,
        severity: alert.result.severity,
        message: alert.result.message,
        metrics: alert.result.metrics,
      })),
    };
  }

  private async handleGetStatistics(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const window: TimeWindow = {
      start: new Date(args.startTime as string),
      end: new Date(args.endTime as string),
      granularity: args.granularity as TimeWindow["granularity"],
    };

    const components = this.power.getComponents();
    const statistics = await components.ragMonitor.getStatistics(window);

    return {
      statistics: {
        queryCount: statistics.queryCount,
        successRate: statistics.successRate,
        avgRelevanceScore: statistics.avgRelevanceScore,
        avgLatencyMs: statistics.avgLatencyMs,
        p95LatencyMs: statistics.p95LatencyMs,
        errorBreakdown: statistics.errorBreakdown,
      },
    };
  }

  private async handleGetRecentFailures(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const components = this.power.getComponents();
    const failures = await components.failureCapturer.listFailures({
      limit: (args.limit as number) || 10,
      errorType: args.errorType as string | undefined,
    });

    return {
      failures: failures.map((f) => ({
        id: f.id,
        timestamp: f.timestamp,
        query: f.queryEvent.query,
        errorType: f.queryEvent.errorDetails?.type,
        replayable: f.replayable,
      })),
    };
  }

  private async handleReplayFailure(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const failureId = args.failureId as string;
    const components = this.power.getComponents();
    const result = await components.failureCapturer.replayFailure(failureId);

    return {
      failureId: result.failureId,
      reproduced: result.reproduced,
      originalOutput: result.originalOutput,
      replayOutput: result.replayOutput,
      differences: result.differences,
    };
  }

  private async handleSearchSimilarErrors(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const components = this.power.getComponents();
    const similarErrors = await components.errorKnowledgeBase.searchSimilar({
      queryText: args.query as string,
      type: args.errorType as ErrorType | undefined,
      limit: (args.limit as number) || 5,
    });

    return {
      results: similarErrors.map((se) => ({
        errorId: se.error.id,
        type: se.error.type,
        component: se.error.component,
        severity: se.error.severity,
        similarity: se.similarity,
        timestamp: se.error.timestamp,
        fixes: se.fixes.map((f) => ({
          description: f.description,
          successRate: f.successRate,
          resolved: f.resolved,
        })),
      })),
    };
  }
}

/**
 * Create an MCP tool handler for a power instance
 */
export function createMCPToolHandler(
  power: RAGObservabilityPower
): MCPToolHandler {
  return new MCPToolHandler(power);
}


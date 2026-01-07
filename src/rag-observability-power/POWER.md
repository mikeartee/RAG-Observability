# RAG Observability Power

A comprehensive Kiro POWER for RAG (Retrieval-Augmented Generation) system observability and self-improvement. This power answers three critical questions when RAG failures occur: **Where did it break?** **Why did it break?** **How do we fix it?**

## Overview

The RAG Observability Power combines statistical process control, deterministic failure capture, and machine learning to provide complete visibility into RAG system behavior. It learns from past failures to prevent future issues and suggests fixes based on accumulated knowledge.

### Key Features

- **Statistical Process Control**: Monitor RAG performance over populations of queries, not just individual failures
- **Drift Detection**: Automatically detect when RAG performance degrades beyond acceptable bounds
- **Code Correlation**: Link performance changes to specific code commits
- **Failure Capture & Replay**: Make probabilistic RAG failures deterministically reproducible
- **Error Knowledge Base**: RAG-enabled storage of errors, fixes, and patterns with semantic search
- **Self-Improvement Loop**: Surface relevant past errors during coding to prevent repeating mistakes
- **Fix Suggestions**: Automatically suggest solutions based on similar past errors

## Architecture

The power follows a layered architecture inspired by Sentry's approach to error monitoring, adapted for probabilistic RAG systems:

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                        │
│  Self-Improvement Loop • Steering Rules • Coding Context   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│           Dashboard • Alerts • Visualizations              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Layer                          │
│  Error Knowledge Base • Fix Suggester • Vector Search      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Analysis Layer                          │
│    Drift Detector • Failure Capturer • Code Correlator    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Data Collection Layer                      │
│        RAG Monitor • Query Interceptor • Git Hooks         │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### RAG Monitor
Intercepts and logs all RAG operations, capturing quality metrics, success rates, and performance data over time.

### Drift Detector
Applies statistical process control to identify when RAG performance degrades beyond acceptable bounds with confidence intervals.

### Code Correlator
Links performance degradation to code changes by analyzing git history and ranking commits by likelihood of causing issues.

### Failure Capturer
Snapshots complete system state when failures occur, enabling deterministic replay of probabilistic failures.

### Error Knowledge Base
Stores errors and fixes with semantic search capabilities, enabling the system to learn from past issues.

### Fix Suggester
Retrieves and ranks fixes from the knowledge base based on similarity and historical success rates.

### Self-Improvement Loop
Integrates with coding sessions to surface relevant errors and auto-generate steering rules.

## Getting Started

### Installation

```bash
npm install rag-observability-power
```

### Basic Setup

```typescript
import { createRAGObservabilityPower } from 'rag-observability-power';

// Create the power with configuration
const power = await createRAGObservabilityPower({
  vectorDb: {
    type: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: 'rag-observability'
  },
  storage: {
    type: 'memory' // or 'sqlite', 'postgres'
  },
  monitoring: {
    controlLimits: {
      successRateLower: 0.85,
      relevanceScoreLower: 0.7,
      latencyUpper: 5000,
      sigma: 2
    }
  }
});

// Start monitoring
await power.initialize();
```

### Logging RAG Queries

```typescript
// Log a RAG query for monitoring
await power.logQuery({
  id: 'query-123',
  timestamp: new Date(),
  query: 'What is the capital of France?',
  retrievedDocuments: [
    {
      id: 'doc-1',
      content: 'Paris is the capital of France...',
      score: 0.95,
      metadata: { source: 'wikipedia' }
    }
  ],
  contextWindow: 'Context: Paris is the capital...',
  generationOutput: 'The capital of France is Paris.',
  qualityMetrics: {
    retrievalRelevanceScore: 0.95,
    generationConfidence: 0.92,
    latencyMs: 1200,
    tokenCount: 150
  },
  success: true
});
```

### Getting Relevant Errors During Coding

```typescript
// Get relevant past errors for current coding context
const relevantErrors = await power.getRelevantErrors({
  currentFile: 'src/rag/retriever.ts',
  recentChanges: [
    {
      path: 'src/rag/retriever.ts',
      changeType: 'modified',
      diff: '+ const embeddings = await generateEmbeddings(query);'
    }
  ],
  ragRelatedFiles: ['src/rag/retriever.ts', 'src/rag/generator.ts'],
  sessionId: 'session-456'
});

// Surface warnings in coding context
relevantErrors.forEach(error => {
  console.log(`⚠️  ${error.warning}`);
  if (error.suggestedFix) {
    console.log(`💡 Suggested fix: ${error.suggestedFix.description}`);
  }
});
```

## MCP Tools

The power exposes several MCP (Model Context Protocol) tools for integration with Kiro:

### Core Monitoring Tools

- **`rag_log_query`**: Log RAG query events with quality metrics
- **`rag_get_statistics`**: Get RAG system statistics for time windows
- **`rag_get_drift_alerts`**: Get active performance drift alerts

### Error Management Tools

- **`rag_get_recent_failures`**: Get recent failures with full context
- **`rag_replay_failure`**: Replay captured failures for debugging
- **`rag_search_similar_errors`**: Search for similar past errors

### Self-Improvement Tools

- **`rag_get_relevant_errors`**: Get relevant errors for coding context
- **`rag_suggest_fixes`**: Get fix suggestions for specific errors

## Configuration

### Vector Database Configuration

```typescript
// Pinecone configuration
const vectorDbConfig = {
  type: 'pinecone',
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
  indexName: 'rag-observability',
  dimension: 1536 // OpenAI embedding dimension
};

// Chroma configuration (alternative)
const chromaConfig = {
  type: 'chroma',
  host: 'localhost',
  port: 8000,
  collection: 'rag-errors'
};
```

### Control Limits Configuration

```typescript
const controlLimits = {
  successRateLower: 0.85,      // Alert if success rate drops below 85%
  relevanceScoreLower: 0.7,    // Alert if relevance drops below 0.7
  latencyUpper: 5000,          // Alert if latency exceeds 5 seconds
  sigma: 2                     // 2-sigma control limits (95% confidence)
};
```

### Self-Improvement Configuration

```typescript
const selfImprovementConfig = {
  steeringRuleThreshold: 3,    // Generate rule after 3 successful fixes
  maxRelevantErrors: 5,        // Max errors to surface per coding session
  relevanceThreshold: 0.6      // Minimum relevance score to surface error
};
```

## Use Cases

### 1. RAG Performance Monitoring

Monitor your RAG system's health over time:

```typescript
// Get statistics for the last 24 hours
const stats = await power.getStatistics({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
  granularity: 'hour'
});

console.log(`Success rate: ${stats.successRate * 100}%`);
console.log(`Average relevance: ${stats.avgRelevanceScore}`);
console.log(`P95 latency: ${stats.p95LatencyMs}ms`);
```

### 2. Debugging RAG Failures

Capture and replay failures for debugging:

```typescript
// Failures are automatically captured when logged with success: false
// List recent failures
const failures = await power.getRecentFailures({ limit: 10 });

// Replay a specific failure
const replayResult = await power.replayFailure(failures[0].id);
console.log(`Reproduced: ${replayResult.reproduced}`);
console.log(`Differences: ${replayResult.differences.join(', ')}`);
```

### 3. Learning from Past Errors

Build institutional knowledge about RAG issues:

```typescript
// Search for similar errors
const similarErrors = await power.searchSimilarErrors({
  query: 'embedding generation timeout',
  limit: 5
});

// Get fix suggestions
const suggestions = await power.suggestFixes(errorId);
suggestions.forEach(suggestion => {
  console.log(`Fix: ${suggestion.suggestedFix.description}`);
  console.log(`Success rate: ${suggestion.suggestedFix.successRate * 100}%`);
});
```

### 4. Proactive Error Prevention

Surface relevant errors during coding:

```typescript
// Automatically called when editing RAG-related files
const context = {
  currentFile: 'src/embeddings/generator.ts',
  ragRelatedFiles: ['src/embeddings/generator.ts'],
  sessionId: 'current-session'
};

const relevantErrors = await power.getRelevantErrors(context);
// Errors are automatically surfaced as warnings in the coding context
```

## Best Practices

### 1. Comprehensive Logging

Log all RAG operations, not just failures:

```typescript
// Log successful queries too
await power.logQuery({
  // ... query details
  success: true,
  qualityMetrics: {
    retrievalRelevanceScore: 0.89,
    generationConfidence: 0.91,
    latencyMs: 800,
    tokenCount: 120
  }
});
```

### 2. Meaningful Quality Metrics

Provide accurate quality metrics for effective monitoring:

```typescript
const qualityMetrics = {
  retrievalRelevanceScore: calculateRelevanceScore(query, documents),
  generationConfidence: model.getConfidenceScore(),
  latencyMs: endTime - startTime,
  tokenCount: countTokens(generationOutput)
};
```

### 3. Regular Baseline Updates

Update baselines periodically to adapt to system changes:

```typescript
// Update baseline weekly or after major changes
await power.updateBaseline();
```

### 4. Act on Drift Alerts

Monitor and respond to drift alerts promptly:

```typescript
const alerts = await power.getActiveDriftAlerts();
alerts.forEach(alert => {
  if (alert.severity === 'critical') {
    // Immediate action required
    notifyOnCall(alert);
  }
});
```

## Troubleshooting

### Common Issues

**Vector DB Connection Errors**
- Verify API keys and connection settings
- Check network connectivity to vector database
- Ensure index exists and has correct dimensions

**High Memory Usage**
- Configure appropriate batch sizes for embedding generation
- Use streaming for large query volumes
- Consider external storage for large failure captures

**Slow Performance**
- Optimize vector database queries with appropriate filters
- Use appropriate time windows for statistics calculation
- Consider caching for frequently accessed data

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const power = await createRAGObservabilityPower({
  // ... other config
  debug: true,
  logLevel: 'debug'
});
```

## Contributing

This power is designed to be extensible. Key extension points:

- **Storage Backends**: Implement custom storage for errors and metrics
- **Vector Databases**: Add support for additional vector databases
- **Quality Metrics**: Define custom quality metrics for your RAG system
- **Alert Channels**: Add custom alerting mechanisms
- **Dashboard Integrations**: Connect to existing monitoring dashboards

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions, please refer to the project repository or contact the maintainers.

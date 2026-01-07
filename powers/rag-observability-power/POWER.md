---
name: "rag-observability-power"
displayName: "RAG Observability Power"
description: "Comprehensive RAG system monitoring with drift detection, failure capture, and self-improvement capabilities. Answers where, why, and how to fix RAG failures."
keywords: ["rag", "observability", "monitoring", "drift-detection", "error-tracking", "self-improvement"]
author: "RAG Observability Team"
---

# RAG Observability Power

A comprehensive Kiro Power for RAG (Retrieval-Augmented Generation) system observability and self-improvement. This power answers three critical questions when RAG failures occur: **Where did it break?** **Why did it break?** **How do we fix it?**

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

## Available Steering Files

This power includes three comprehensive steering files with detailed patterns and best practices:

- **rag-error-handling** - Best practices for handling and learning from RAG system errors, including error classification, recovery strategies, and prevention patterns
- **rag-monitoring-best-practices** - Guidelines for effective RAG system monitoring and observability, covering statistical process control and alerting strategies  
- **rag-self-improvement** - Patterns for building self-improving RAG systems that learn from experience and continuously optimize performance

Call action "readSteering" to access specific steering files as needed for your RAG implementation.

## Available MCP Tools

This power provides 8 MCP tools for comprehensive RAG system monitoring and improvement:

### Core Monitoring Tools

- **`rag_log_query`**: Log RAG query events with quality metrics for monitoring and analysis
- **`rag_get_statistics`**: Get RAG system statistics for time windows with granular breakdowns
- **`rag_get_drift_alerts`**: Get active performance drift alerts showing degradation

### Error Management Tools

- **`rag_get_recent_failures`**: Get recent failures with full context for debugging
- **`rag_replay_failure`**: Replay captured failures to reproduce probabilistic issues
- **`rag_search_similar_errors`**: Search for similar past errors using semantic search

### Self-Improvement Tools

- **`rag_get_relevant_errors`**: Get relevant errors for current coding context to avoid repeating mistakes
- **`rag_suggest_fixes`**: Get fix suggestions based on similar past errors and success rates

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

## Onboarding

### Prerequisites

- **Vector Database**: Pinecone or Chroma for semantic error search
- **Node.js**: Version 16+ for MCP server execution
- **Git Repository**: For code correlation features
- **RAG System**: Existing RAG implementation to monitor

### Installation

The MCP server is automatically configured when you install this power. No additional installation steps required.

### Configuration

Configure the power through environment variables:

**Required Environment Variables:**
- `VECTOR_DB_TYPE`: Vector database type (`pinecone` or `chroma`)
- `VECTOR_DB_API_KEY`: API key for your vector database
- `VECTOR_DB_ENVIRONMENT`: Environment/region for your vector database
- `VECTOR_DB_INDEX_NAME`: Index name for storing error embeddings

**Optional Environment Variables:**
- `STORAGE_TYPE`: Storage backend (`memory`, `sqlite`, `postgres`) - defaults to `memory`
- `STORAGE_CONNECTION_STRING`: Database connection string (for sqlite/postgres)
- `SUCCESS_RATE_LOWER`: Lower control limit for success rate (default: 0.85)
- `RELEVANCE_SCORE_LOWER`: Lower control limit for relevance (default: 0.7)
- `LATENCY_UPPER`: Upper control limit for latency in ms (default: 5000)
- `CONTROL_SIGMA`: Sigma level for control limits (default: 2)

### Basic Setup

```typescript
// 1. Log RAG queries for monitoring
await rag_log_query({
  query: "What is the capital of France?",
  retrievedDocuments: [
    {
      id: "doc-1",
      content: "Paris is the capital of France...",
      score: 0.95,
      metadata: { source: "wikipedia" }
    }
  ],
  generationOutput: "The capital of France is Paris.",
  qualityMetrics: {
    retrievalRelevanceScore: 0.95,
    generationConfidence: 0.92,
    latencyMs: 1200,
    tokenCount: 150
  },
  success: true
});

// 2. Monitor system health
const stats = await rag_get_statistics({
  startTime: "2024-01-01T00:00:00Z",
  endTime: "2024-01-02T00:00:00Z",
  granularity: "hour"
});

// 3. Check for performance issues
const alerts = await rag_get_drift_alerts();
```

## Common Workflows

### Workflow 1: RAG Performance Monitoring

**Goal**: Monitor your RAG system's health and detect performance degradation

**Steps:**
1. **Log all RAG queries** (both successful and failed)
2. **Monitor key metrics** using statistics tools
3. **Set up drift alerts** to catch performance issues early
4. **Investigate alerts** when they occur

**Example:**
```typescript
// Step 1: Log every RAG query
await rag_log_query({
  query: userQuery,
  retrievedDocuments: documents,
  generationOutput: response,
  qualityMetrics: {
    retrievalRelevanceScore: calculateRelevance(userQuery, documents),
    generationConfidence: model.getConfidence(),
    latencyMs: responseTime,
    tokenCount: countTokens(response)
  },
  success: !error,
  errorDetails: error ? { message: error.message, stack: error.stack } : undefined
});

// Step 2: Check system health daily
const dailyStats = await rag_get_statistics({
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  endTime: new Date().toISOString(),
  granularity: "hour"
});

console.log(`Success rate: ${dailyStats.successRate * 100}%`);
console.log(`Average relevance: ${dailyStats.avgRelevanceScore}`);

// Step 3: Check for active alerts
const alerts = await rag_get_drift_alerts();
if (alerts.length > 0) {
  console.log(`⚠️ ${alerts.length} active performance alerts`);
  alerts.forEach(alert => {
    console.log(`- ${alert.metric}: ${alert.message}`);
  });
}
```

**Common Errors:**
- **Error**: "Vector database connection failed"
  - **Cause**: Invalid API key or network issues
  - **Solution**: Verify `VECTOR_DB_API_KEY` and network connectivity

### Workflow 2: Debugging RAG Failures

**Goal**: Investigate and reproduce specific RAG failures for debugging

**Steps:**
1. **Get recent failures** to identify problematic queries
2. **Replay failures** to reproduce issues deterministically
3. **Search for similar errors** to understand patterns
4. **Apply fixes** and verify resolution

**Example:**
```typescript
// Step 1: Get recent failures
const failures = await rag_get_recent_failures({
  limit: 10,
  errorType: "retrieval_failure"
});

console.log(`Found ${failures.length} recent retrieval failures`);

// Step 2: Replay a specific failure
const failureToDebug = failures[0];
const replayResult = await rag_replay_failure({
  failureId: failureToDebug.id
});

console.log(`Failure reproduced: ${replayResult.reproduced}`);
if (!replayResult.reproduced) {
  console.log(`Differences: ${replayResult.differences.join(", ")}`);
}

// Step 3: Search for similar errors
const similarErrors = await rag_search_similar_errors({
  query: failureToDebug.errorMessage,
  limit: 5
});

console.log(`Found ${similarErrors.length} similar errors`);
similarErrors.forEach(error => {
  console.log(`- ${error.type}: ${error.message} (${error.frequency} occurrences)`);
});
```

**Common Errors:**
- **Error**: "Failure ID not found"
  - **Cause**: Failure was not captured or ID is incorrect
  - **Solution**: Verify failure ID from `rag_get_recent_failures` results

### Workflow 3: Learning from Past Errors

**Goal**: Build institutional knowledge and get proactive fix suggestions

**Steps:**
1. **Search for similar errors** when encountering new issues
2. **Get fix suggestions** based on past successful resolutions
3. **Apply suggested fixes** and track their effectiveness
4. **Build error knowledge base** over time

**Example:**
```typescript
// Step 1: When you encounter an error, search for similar ones
const currentError = "Embedding generation timeout after 30 seconds";
const similarErrors = await rag_search_similar_errors({
  query: currentError,
  limit: 5
});

// Step 2: Get fix suggestions for the most similar error
if (similarErrors.length > 0) {
  const suggestions = await rag_suggest_fixes({
    errorId: similarErrors[0].id
  });
  
  console.log("Suggested fixes:");
  suggestions.forEach(suggestion => {
    console.log(`- ${suggestion.description} (${suggestion.successRate * 100}% success rate)`);
    console.log(`  Reasoning: ${suggestion.reasoning}`);
  });
}

// Step 3: After applying a fix, log the outcome
await rag_log_query({
  query: "Test query after applying timeout fix",
  // ... other parameters
  success: true, // or false if fix didn't work
  errorDetails: undefined // or error details if still failing
});
```

**Common Errors:**
- **Error**: "No similar errors found"
  - **Cause**: This is a novel error pattern
  - **Solution**: This is expected for new error types - the system will learn from this error

### Workflow 4: Proactive Error Prevention

**Goal**: Surface relevant past errors during coding to prevent repeating mistakes

**Steps:**
1. **Get relevant errors** for your current coding context
2. **Review warnings** and suggested fixes
3. **Apply preventive measures** based on past learnings
4. **Track helpfulness** of surfaced errors

**Example:**
```typescript
// Step 1: Get relevant errors for current coding session
const relevantErrors = await rag_get_relevant_errors({
  currentFile: "src/rag/retriever.ts",
  recentChanges: [
    {
      path: "src/rag/retriever.ts",
      changeType: "modified",
      diff: "+ const embeddings = await generateEmbeddings(query);"
    }
  ],
  ragRelatedFiles: ["src/rag/retriever.ts", "src/rag/generator.ts"],
  sessionId: "current-coding-session"
});

// Step 2: Review and act on warnings
relevantErrors.forEach(error => {
  console.log(`⚠️ ${error.warning}`);
  if (error.suggestedFix) {
    console.log(`💡 Suggested fix: ${error.suggestedFix.description}`);
    console.log(`   Success rate: ${error.suggestedFix.successRate * 100}%`);
  }
});

// Step 3: The system automatically learns from your coding patterns
// and will surface increasingly relevant errors over time
```

**Common Errors:**
- **Error**: "No relevant errors found"
  - **Cause**: No past errors related to current coding context
  - **Solution**: This is normal for new code areas - the system will learn as you work

## Troubleshooting

### MCP Server Connection Issues

**Problem**: MCP server won't start or connect
**Symptoms**:
- Error: "Connection refused"
- Server not responding
- Tools not available in Kiro

**Solutions**:
1. **Verify environment variables are set correctly**:
   ```bash
   echo $VECTOR_DB_TYPE
   echo $VECTOR_DB_API_KEY
   ```
2. **Check vector database connectivity**:
   - Test API key with vector database directly
   - Verify network access to vector database service
3. **Review MCP server logs** for specific errors
4. **Restart Kiro** and try reconnecting to MCP server

### Vector Database Issues

**Problem**: Vector database operations failing
**Symptoms**:
- Error: "Index not found"
- Error: "Authentication failed"
- Slow query performance

**Solutions**:
1. **Verify index exists**:
   - Check your vector database dashboard
   - Create index if missing with correct dimensions (1536 for OpenAI embeddings)
2. **Check API key permissions**:
   - Ensure API key has read/write access to the index
   - Verify API key is not expired
3. **Optimize query performance**:
   - Use appropriate filters in queries
   - Consider index configuration for your use case

### High Memory Usage

**Problem**: MCP server consuming excessive memory
**Symptoms**:
- System slowdown
- Out of memory errors
- High memory usage in task manager

**Solutions**:
1. **Configure storage backend**:
   - Use `sqlite` or `postgres` instead of `memory` for large datasets
   - Set `STORAGE_TYPE=sqlite` and `STORAGE_CONNECTION_STRING`
2. **Limit query batch sizes**:
   - Process queries in smaller batches
   - Use streaming for large volumes
3. **Clean up old data**:
   - Implement data retention policies
   - Archive old error records

### Performance Issues

**Problem**: Slow response times from MCP tools
**Symptoms**:
- Tools taking >5 seconds to respond
- Timeouts in Kiro
- Degraded user experience

**Solutions**:
1. **Optimize vector database queries**:
   - Use appropriate similarity thresholds
   - Limit result counts with `limit` parameters
2. **Configure appropriate time windows**:
   - Use smaller time ranges for statistics
   - Consider caching for frequently accessed data
3. **Check system resources**:
   - Monitor CPU and memory usage
   - Consider scaling vector database if needed

## Best Practices

### 1. Comprehensive Logging

**Log all RAG operations, not just failures**:
- Include quality metrics for every query
- Log successful queries to establish baselines
- Capture context information for better debugging

### 2. Meaningful Quality Metrics

**Provide accurate quality metrics for effective monitoring**:
- Calculate relevance scores based on your specific use case
- Use confidence scores from your generation model
- Track latency at appropriate granularity
- Count tokens accurately for cost monitoring

### 3. Regular Monitoring

**Check system health proactively**:
- Review daily statistics for trends
- Set up alerts for critical metrics
- Monitor drift alerts and investigate promptly
- Update baselines after system changes

### 4. Error Knowledge Building

**Build institutional knowledge systematically**:
- Search for similar errors before creating new tickets
- Document fix outcomes and success rates
- Share learnings across team members
- Use relevant error surfacing during code reviews

### 5. Configuration Management

**Manage configuration properly**:
- Use environment variables for sensitive data
- Document configuration requirements clearly
- Test configuration changes in staging first
- Keep backup configurations for rollback

## Configuration

### Vector Database Configuration

**Pinecone Configuration**:
```bash
VECTOR_DB_TYPE=pinecone
VECTOR_DB_API_KEY=your-pinecone-api-key
VECTOR_DB_ENVIRONMENT=us-west1-gcp
VECTOR_DB_INDEX_NAME=rag-observability
```

**Chroma Configuration**:
```bash
VECTOR_DB_TYPE=chroma
VECTOR_DB_API_KEY=your-chroma-api-key
VECTOR_DB_ENVIRONMENT=production
VECTOR_DB_INDEX_NAME=rag-errors
```

### Storage Configuration

**Memory Storage (Default)**:
```bash
STORAGE_TYPE=memory
```

**SQLite Storage**:
```bash
STORAGE_TYPE=sqlite
STORAGE_CONNECTION_STRING=./rag-observability.db
```

**PostgreSQL Storage**:
```bash
STORAGE_TYPE=postgres
STORAGE_CONNECTION_STRING=postgresql://user:password@localhost:5432/rag_observability
```

### Monitoring Configuration

**Control Limits**:
```bash
SUCCESS_RATE_LOWER=0.85      # Alert if success rate drops below 85%
RELEVANCE_SCORE_LOWER=0.7    # Alert if relevance drops below 0.7
LATENCY_UPPER=5000           # Alert if latency exceeds 5 seconds
CONTROL_SIGMA=2              # 2-sigma control limits (95% confidence)
```

### Self-Improvement Configuration

**Error Surfacing**:
```bash
STEERING_RULE_THRESHOLD=3    # Generate rule after 3 successful fixes
MAX_RELEVANT_ERRORS=5        # Max errors to surface per coding session
RELEVANCE_THRESHOLD=0.6      # Minimum relevance score to surface error
```

## MCP Config Placeholders

**IMPORTANT**: Before using this power, replace the following placeholders in `mcp.json` with your actual values:

- **`YOUR_VECTOR_DB_API_KEY`**: Your vector database API key (Pinecone or Chroma).
  - **How to get it**:
    1. Go to your vector database dashboard (Pinecone Console or Chroma admin)
    2. Navigate to API Keys section
    3. Create or copy your API key
    4. Set as environment variable: `VECTOR_DB_API_KEY=your-actual-key`

- **`YOUR_VECTOR_DB_ENVIRONMENT`**: Your vector database environment/region.
  - **How to get it**: Check your vector database dashboard for environment name (e.g., "us-west1-gcp" for Pinecone)

- **`YOUR_INDEX_NAME`**: Name of your vector database index for storing error embeddings.
  - **How to set it**: Choose a descriptive name (e.g., "rag-observability-errors") and create the index in your vector database with 1536 dimensions

After replacing placeholders, your environment should look like:
```bash
VECTOR_DB_TYPE=pinecone
VECTOR_DB_API_KEY=pk-abc123xyz789...
VECTOR_DB_ENVIRONMENT=us-west1-gcp
VECTOR_DB_INDEX_NAME=rag-observability-errors
STORAGE_TYPE=sqlite
STORAGE_CONNECTION_STRING=./rag-observability.db
```

---

**Package**: `rag-observability-power`
**MCP Server**: rag-observability-power
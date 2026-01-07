---
name: "rag-observability"
displayName: "RAG Observability"
description: "Comprehensive guide for RAG system monitoring with drift detection, failure capture, and self-improvement patterns. Learn where, why, and how to fix RAG failures."
keywords: ["rag", "observability", "monitoring", "drift-detection", "error-tracking", "self-improvement"]
author: "Michael Rewiri-Thorsen"
---

# RAG Observability

A comprehensive knowledge base for RAG (Retrieval-Augmented Generation) system observability and self-improvement. This power answers three critical questions when RAG failures occur: **Where did it break?** **Why did it break?** **How do we fix it?**

## Overview

This power provides patterns, best practices, and implementation guidance for building observable RAG systems. It covers statistical process control, deterministic failure capture, and machine learning approaches to provide complete visibility into RAG system behavior.

### Key Concepts

- **Statistical Process Control**: Monitor RAG performance over populations of queries, not just individual failures
- **Drift Detection**: Automatically detect when RAG performance degrades beyond acceptable bounds
- **Code Correlation**: Link performance changes to specific code commits
- **Failure Capture & Replay**: Make probabilistic RAG failures deterministically reproducible
- **Error Knowledge Base**: Store errors, fixes, and patterns with semantic search
- **Self-Improvement Loop**: Surface relevant past errors during coding to prevent repeating mistakes
- **Fix Suggestions**: Suggest solutions based on similar past errors

## Available Steering Files

This power includes three comprehensive steering files with detailed patterns and best practices:

- **rag-error-handling** - Best practices for handling and learning from RAG system errors, including error classification, recovery strategies, and prevention patterns
- **rag-monitoring-best-practices** - Guidelines for effective RAG system monitoring and observability, covering statistical process control and alerting strategies
- **rag-self-improvement** - Patterns for building self-improving RAG systems that learn from experience and continuously optimize performance

Call action "readSteering" to access specific steering files as needed for your RAG implementation.

## Architecture

The recommended architecture follows a layered approach inspired by Sentry's error monitoring, adapted for probabilistic RAG systems:

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

**Key metrics to capture:**
- Query text and retrieved documents
- Relevance scores and confidence levels
- Latency and token counts
- Success/failure status with error details

### Drift Detector

Applies statistical process control to identify when RAG performance degrades beyond acceptable bounds with confidence intervals.

**Control limits to configure:**
- Success rate lower bound (e.g., 85%)
- Relevance score lower bound (e.g., 0.7)
- Latency upper bound (e.g., 5000ms)
- Sigma level for confidence (e.g., 2-sigma = 95%)

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

## Common Workflows

### Workflow 1: RAG Performance Monitoring

**Goal**: Monitor your RAG system's health and detect performance degradation

**Steps:**
1. **Instrument your RAG pipeline** to log all queries with quality metrics
2. **Define control limits** for key metrics (success rate, relevance, latency)
3. **Set up drift detection** to alert when metrics exceed control limits
4. **Review alerts** and investigate root causes

**Implementation pattern:**
```typescript
// Log every RAG query with quality metrics
function logRAGQuery(query: string, result: RAGResult) {
  const metrics = {
    query,
    retrievedDocuments: result.documents,
    generationOutput: result.response,
    qualityMetrics: {
      retrievalRelevanceScore: calculateRelevance(query, result.documents),
      generationConfidence: result.confidence,
      latencyMs: result.latency,
      tokenCount: countTokens(result.response)
    },
    success: !result.error,
    timestamp: new Date()
  };
  
  // Store metrics for analysis
  metricsStore.log(metrics);
  
  // Check against control limits
  driftDetector.check(metrics);
}
```

### Workflow 2: Debugging RAG Failures

**Goal**: Investigate and reproduce specific RAG failures

**Steps:**
1. **Capture failure context** including full system state
2. **Replay failures** to reproduce issues deterministically
3. **Search for similar errors** to understand patterns
4. **Apply and verify fixes**

**Implementation pattern:**
```typescript
// Capture complete failure context
function captureFailure(query: string, error: Error, context: RAGContext) {
  const failure = {
    id: generateId(),
    timestamp: new Date(),
    query,
    error: {
      message: error.message,
      stack: error.stack,
      type: classifyError(error)
    },
    context: {
      retrievedDocuments: context.documents,
      embeddingModel: context.embeddingModel,
      generationModel: context.generationModel,
      temperature: context.temperature,
      systemPrompt: context.systemPrompt
    },
    environment: {
      nodeVersion: process.version,
      dependencies: getDependencyVersions()
    }
  };
  
  failureStore.save(failure);
  return failure.id;
}
```

### Workflow 3: Learning from Past Errors

**Goal**: Build institutional knowledge and get proactive fix suggestions

**Steps:**
1. **Store errors with embeddings** for semantic search
2. **Search for similar errors** when encountering new issues
3. **Track fix effectiveness** to rank suggestions
4. **Surface relevant errors** during coding

**Implementation pattern:**
```typescript
// Search for similar past errors
async function findSimilarErrors(errorMessage: string, limit: number = 5) {
  const embedding = await generateEmbedding(errorMessage);
  const similar = await vectorDb.search(embedding, {
    topK: limit,
    filter: { type: 'error' }
  });
  
  return similar.map(result => ({
    error: result.metadata,
    similarity: result.score,
    fixes: result.metadata.fixes || []
  }));
}

// Get fix suggestions ranked by success rate
function suggestFixes(similarErrors: SimilarError[]) {
  const allFixes = similarErrors.flatMap(e => e.fixes);
  
  return allFixes
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
}
```

## Best Practices

### 1. Comprehensive Logging

Log all RAG operations, not just failures:
- Include quality metrics for every query
- Log successful queries to establish baselines
- Capture context information for better debugging

### 2. Meaningful Quality Metrics

Provide accurate quality metrics for effective monitoring:
- Calculate relevance scores based on your specific use case
- Use confidence scores from your generation model
- Track latency at appropriate granularity
- Count tokens accurately for cost monitoring

### 3. Regular Monitoring

Check system health proactively:
- Review daily statistics for trends
- Set up alerts for critical metrics
- Monitor drift alerts and investigate promptly
- Update baselines after system changes

### 4. Error Knowledge Building

Build institutional knowledge systematically:
- Search for similar errors before creating new tickets
- Document fix outcomes and success rates
- Share learnings across team members
- Use relevant error surfacing during code reviews

### 5. Statistical Process Control

Use SPC principles for drift detection:
- Calculate control limits from baseline data
- Use appropriate sigma levels (2-sigma for 95% confidence)
- Update baselines periodically
- Distinguish between common cause and special cause variation

## Troubleshooting

### High False Positive Rate in Drift Detection

**Problem**: Too many alerts that aren't real issues

**Solutions**:
1. Increase sigma level (e.g., from 2 to 3)
2. Use longer baseline periods
3. Filter out known transient issues
4. Implement alert suppression for maintenance windows

### Poor Error Similarity Matching

**Problem**: Similar error search returns irrelevant results

**Solutions**:
1. Improve embedding model for your domain
2. Add metadata filters (error type, component)
3. Use hybrid search (semantic + keyword)
4. Fine-tune similarity thresholds

### Slow Query Performance

**Problem**: Monitoring adds too much latency

**Solutions**:
1. Use async logging (don't block main path)
2. Batch metrics writes
3. Sample high-volume queries
4. Use efficient vector database indexes

## Configuration Reference

### Control Limits

| Metric | Default | Description |
|--------|---------|-------------|
| Success Rate Lower | 0.85 | Alert if success rate drops below 85% |
| Relevance Score Lower | 0.7 | Alert if average relevance drops below 0.7 |
| Latency Upper | 5000ms | Alert if P95 latency exceeds 5 seconds |
| Control Sigma | 2 | 2-sigma = 95% confidence interval |

### Storage Options

| Type | Use Case | Pros | Cons |
|------|----------|------|------|
| Memory | Development | Fast, simple | Lost on restart |
| SQLite | Single instance | Persistent, simple | Not distributed |
| PostgreSQL | Production | Scalable, reliable | More setup |

### Vector Database Options

| Database | Use Case | Pros | Cons |
|----------|----------|------|------|
| Pinecone | Production | Managed, scalable | Cost |
| Chroma | Development | Free, local | Less scalable |
| Weaviate | Self-hosted | Full control | Ops overhead |


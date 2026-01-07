# RAG Observability Power

> ⚠️ **PROJECT STATUS: ABANDONED / LEARNING EXPERIMENT**

This was an experiment in building RAG observability as a Kiro POWER (MCP-based). While the core concepts are solid, the implementation approach turned out to be too manual and not user-friendly enough for practical use.

## What This Was

A Kiro POWER for RAG system observability answering: **Where did it break?** **Why did it break?** **How do we fix it?**

Features built:
- Statistical process control over query populations
- Drift detection with confidence intervals
- Code correlation linking performance to commits
- Failure capture and deterministic replay
- Error knowledge base with semantic search
- Self-improvement loop surfacing past errors

## Why It's Abandoned

The MCP/POWER approach requires manual tool invocation through chat - no buttons, no dashboard, no visual feedback. It works, but the UX is clunky.

## Lessons Learned

1. **MCP tools are great for AI-to-AI communication, not human UX** - Having to type commands to check RAG health defeats the purpose of observability

2. **POWERs aren't portable** - Tied to Kiro specifically, doesn't work with VSCodium or other VS Code forks

3. **Observability needs visual feedback** - Time-series charts, status indicators, and clickable actions belong in a proper UI, not chat responses

4. **The architecture is sound** - The layered design (data collection → analysis → knowledge → presentation) is solid and reusable

5. **Statistical process control for RAG is valuable** - Watching populations of queries rather than individual failures catches degradation early

## Next Steps

Rebuild this as a **universal VS Code extension** that:
- Works across VS Code, VSCodium, Cursor, and other forks
- Has actual UI panels with charts and buttons
- Runs monitoring in the background automatically
- Shows status bar indicators for RAG health at a glance
- Provides one-click failure replay
- Doesn't require typing commands to use

## What's Salvageable

- Core TypeScript interfaces and types (`src/rag-observability-power/src/types/`)
- Statistical calculation logic
- Drift detection algorithms
- Error knowledge base design
- The spec documents in `.kiro/specs/` are a good starting point for the extension version

## Original Architecture

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

## License

MIT License - see [LICENSE](LICENSE)

---

*This repo is kept for reference. The extension version will be a separate project.*


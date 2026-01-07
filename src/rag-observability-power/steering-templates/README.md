# RAG Observability Power - Steering Templates

This directory contains steering file templates for the RAG Observability Power. These templates provide best practices, patterns, and guidelines for effectively using the power in different scenarios.

## Available Templates

### 1. RAG Monitoring Best Practices (`rag-monitoring-best-practices.md`)

**Category:** Monitoring  
**Description:** Guidelines for effective RAG system monitoring and observability

**Key Topics:**
- Statistical process control for RAG systems
- Quality metrics capture and analysis
- Alerting strategies and drift detection
- Performance optimization techniques
- Integration patterns with existing systems

**Use When:**
- Setting up monitoring for a new RAG system
- Improving existing monitoring practices
- Troubleshooting performance issues
- Establishing alerting thresholds

### 2. RAG Error Handling Patterns (`rag-error-handling.md`)

**Category:** Error Handling  
**Description:** Best practices for handling and learning from RAG system errors

**Key Topics:**
- Error classification and context capture
- Graceful degradation strategies
- Error recovery patterns
- Learning from error patterns
- Prevention strategies and circuit breakers

**Use When:**
- Implementing error handling in RAG systems
- Improving system resilience
- Building error recovery mechanisms
- Analyzing recurring error patterns

### 3. RAG Self-Improvement Patterns (`rag-self-improvement.md`)

**Category:** Self-Improvement  
**Description:** Patterns for building self-improving RAG systems that learn from experience

**Key Topics:**
- Learning from every interaction
- Context-aware error surfacing
- Automatic steering rule generation
- Quality feedback loops
- Predictive error prevention

**Use When:**
- Building adaptive RAG systems
- Implementing continuous improvement
- Creating learning feedback loops
- Developing proactive error prevention

## How to Use These Templates

### 1. Copy to Your Project

Copy the relevant template files to your project's `.kiro/steering/` directory:

```bash
cp steering-templates/rag-monitoring-best-practices.md .kiro/steering/
cp steering-templates/rag-error-handling.md .kiro/steering/
cp steering-templates/rag-self-improvement.md .kiro/steering/
```

### 2. Customize for Your Needs

Edit the copied files to match your specific:
- Technology stack
- Performance requirements
- Error handling policies
- Monitoring infrastructure
- Team practices

### 3. Configure Inclusion Rules

Add front-matter to control when each steering file is included:

```yaml
---
title: "RAG Monitoring Best Practices"
description: "Guidelines for effective RAG system monitoring"
category: "monitoring"
inclusion: "fileMatch"
fileMatchPattern: "**/rag/**"
---
```

**Inclusion Options:**
- `always` (default): Always included in context
- `fileMatch`: Included when editing files matching the pattern
- `manual`: Only included when explicitly referenced with `#steering-file-name`

### 4. Reference in Code

Reference steering files in your code comments:

```typescript
// Following RAG monitoring best practices from rag-monitoring-best-practices.md
await ragObservabilityPower.logQuery({
  // ... comprehensive logging as per steering guidelines
});
```

## Template Structure

Each template follows a consistent structure:

### Front Matter
```yaml
---
title: "Template Title"
description: "Brief description of the template"
category: "template-category"
---
```

### Content Sections
1. **Introduction** - Overview and core principles
2. **Patterns** - Specific implementation patterns with code examples
3. **Anti-Patterns** - Common mistakes to avoid
4. **Best Practices** - Do's and don'ts summary
5. **Integration** - How to integrate with existing systems
6. **Troubleshooting** - Common issues and solutions

## Customization Guidelines

### Adding New Templates

1. Create a new `.md` file in this directory
2. Follow the established structure and naming conventions
3. Include comprehensive code examples
4. Add both positive and negative examples
5. Update this README with the new template

### Modifying Existing Templates

1. Keep the core structure intact
2. Add project-specific examples
3. Adjust thresholds and configurations for your environment
4. Add team-specific practices and policies
5. Document any significant changes

### Template Naming Convention

- Use kebab-case for file names
- Include the main topic and "patterns" or "best-practices"
- Examples: `rag-monitoring-best-practices.md`, `rag-error-handling.md`

## Integration with RAG Observability Power

These templates are designed to work seamlessly with the RAG Observability Power:

### Code Examples
All code examples use the power's APIs and follow its patterns

### Configuration
Templates include configuration examples for the power's components

### Metrics
Templates reference the power's built-in metrics and monitoring capabilities

### Learning
Templates show how to leverage the power's learning and self-improvement features

## Contributing

When contributing new templates or improvements:

1. Follow the established structure and style
2. Include comprehensive code examples
3. Test examples with the actual power implementation
4. Add both success and failure scenarios
5. Update documentation and cross-references

## Support

For questions about these templates or the RAG Observability Power:

1. Check the main POWER.md documentation
2. Review the implementation examples in the templates
3. Consult the power's API documentation
4. Refer to the troubleshooting sections in each template
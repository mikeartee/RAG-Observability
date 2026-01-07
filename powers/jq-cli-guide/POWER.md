---
name: "jq-cli-guide"
displayName: "jq CLI Guide"
description: "Complete guide for using jq command-line JSON processor with common patterns and troubleshooting"
keywords: ["jq", "json", "cli", "parsing", "filtering"]
author: "Kiro Power Builder Example"
---

# jq CLI Guide

## Overview

jq is a lightweight and flexible command-line JSON processor. It's like sed for JSON data - you can use it to slice, filter, map, and transform structured data with ease. This power provides installation instructions, common usage patterns, and troubleshooting for the jq CLI tool.

Whether you're parsing API responses, filtering log files, or transforming JSON data in scripts, jq provides powerful capabilities for working with JSON from the command line.

## Onboarding

### Installation

#### Via Package Managers
```bash
# macOS (Homebrew)
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL/Fedora
sudo yum install jq
# or
sudo dnf install jq

# Windows (Chocolatey)
choco install jq

# Windows (Scoop)
scoop install jq
```

#### Manual Installation
1. Download from: https://jqlang.github.io/jq/download/
2. Extract the binary to a directory in your PATH
3. Make executable (Linux/macOS): `chmod +x jq`

### Prerequisites
- No special prerequisites required
- Works on Linux, macOS, and Windows
- Compatible with any JSON data source

### Verification
```bash
# Verify installation
jq --version

# Expected output:
jq-1.7.1
```

## Common Workflows

### Workflow: Basic JSON Filtering

**Goal:** Extract specific fields from JSON data

**Commands:**
```bash
# Extract a single field
echo '{"name": "John", "age": 30}' | jq '.name'

# Extract multiple fields
echo '{"name": "John", "age": 30, "city": "NYC"}' | jq '{name, age}'

# Extract from array
echo '[{"name": "John"}, {"name": "Jane"}]' | jq '.[].name'
```

**Complete Example:**
```bash
# Parse API response and extract user names
curl -s https://jsonplaceholder.typicode.com/users | jq '.[].name'
```

### Workflow: JSON Transformation

**Goal:** Transform JSON structure and values

**Commands:**
```bash
# Rename fields
echo '{"old_name": "value"}' | jq '{new_name: .old_name}'

# Add computed fields
echo '{"price": 100}' | jq '. + {total: (.price * 1.1)}'

# Group and count
echo '[{"type": "A"}, {"type": "B"}, {"type": "A"}]' | jq 'group_by(.type) | map({type: .[0].type, count: length})'
```

### Workflow: File Processing

**Goal:** Process JSON files and save results

**Commands:**
```bash
# Process file and save output
jq '.users[] | select(.active == true)' input.json > active_users.json

# Pretty print JSON file
jq '.' messy.json > formatted.json

# Compact JSON (remove whitespace)
jq -c '.' formatted.json > compact.json
```

## Command Reference

### jq Basic Syntax

**Purpose:** Core jq filtering and selection syntax

**Syntax:**
```bash
jq [options] 'filter' [file...]
```

**Common Options:**
| Flag | Description | Example |
|------|-------------|---------|
| `-r` | Raw output (no quotes) | `jq -r '.name'` |
| `-c` | Compact output | `jq -c '.'` |
| `-n` | Null input | `jq -n '{}'` |
| `-s` | Slurp (read entire input) | `jq -s '.'` |
| `-e` | Exit with status based on output | `jq -e '.error'` |

**Examples:**
```bash
# Basic field access
jq '.field'

# Array indexing
jq '.[0]'

# Nested access
jq '.user.profile.name'

# Conditional selection
jq 'select(.age > 18)'
```

### Common Filters

**Identity:** `.` - Returns input unchanged
```bash
echo '{"test": true}' | jq '.'
```

**Field Access:** `.field` - Access object field
```bash
echo '{"name": "John"}' | jq '.name'
```

**Array Operations:** `[]`, `.[n]`, `.[n:m]`
```bash
# All array elements
echo '[1,2,3]' | jq '.[]'

# Specific index
echo '[1,2,3]' | jq '.[1]'

# Slice
echo '[1,2,3,4,5]' | jq '.[1:3]'
```

**Pipe:** `|` - Chain operations
```bash
echo '{"users": [{"name": "John"}]}' | jq '.users | .[].name'
```

## Troubleshooting

### Error: "jq: command not found"
**Cause:** jq is not installed or not in PATH
**Solution:**
1. Install jq using package manager (see Installation section)
2. Verify installation: `which jq`
3. If installed but not found, add to PATH

### Error: "parse error: Invalid numeric literal"
**Cause:** Invalid JSON input
**Solution:**
1. Validate JSON input: `echo 'your-json' | jq '.'`
2. Check for trailing commas, unquoted strings, or malformed structure
3. Use online JSON validator if needed

### Error: "jq: error: Cannot index string with string"
**Cause:** Trying to access object field on a string value
**Solution:**
1. Check data structure: `jq 'type'` to see data type
2. Verify the path exists: `jq 'has("fieldname")'`
3. Use conditional access: `jq '.field // "default"'`

### Empty Output When Expected Results
**Cause:** Filter doesn't match data structure
**Solution:**
1. Inspect data structure: `jq '.' input.json`
2. Test filter step by step: `jq '.level1' then jq '.level1.level2'`
3. Use `keys` to see available fields: `jq 'keys'`

## Best Practices

- **Start simple** - Build complex filters step by step
- **Use raw output (-r)** when you need plain text without quotes
- **Validate JSON first** - Always check input is valid JSON
- **Test filters interactively** - Use echo or small files to test before processing large data
- **Handle missing fields** - Use `// "default"` for optional fields
- **Pretty print for debugging** - Use `jq '.'` to format and inspect JSON structure

## Additional Resources

- Official Documentation: https://jqlang.github.io/jq/
- Interactive Tutorial: https://jqplay.org/
- GitHub Repository: https://github.com/jqlang/jq
- Manual: https://jqlang.github.io/jq/manual/

---

**CLI Tool:** `jq`
**Installation:** `brew install jq` (macOS) or see platform-specific instructions above

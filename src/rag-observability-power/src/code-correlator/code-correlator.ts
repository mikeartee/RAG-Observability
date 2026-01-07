/**
 * Code Correlator Implementation
 *
 * Implements the CodeCorrelator interface for linking performance degradation
 * to code changes by analyzing git history and ranking commits.
 */

import { exec } from "child_process";
import { promisify } from "util";

import type {
  CodeCorrelator,
  Commit,
  CommitDiff,
  FileDiff,
  FileChange,
  RankedCommit,
} from "../types/index.js";

const execAsync = promisify(exec);

/**
 * RAG-related file patterns for identifying commits that may affect RAG performance
 */
const RAG_RELATED_PATTERNS = [
  // Retrieval-related
  /retriev/i,
  /search/i,
  /index/i,
  /vector/i,
  /embed/i,
  /chunk/i,
  // Generation-related
  /generat/i,
  /prompt/i,
  /llm/i,
  /model/i,
  /complet/i,
  // RAG-specific
  /rag/i,
  /context/i,
  /document/i,
  /knowledge/i,
  // Configuration
  /config/i,
];

/**
 * High-priority file extensions for RAG systems
 */
const HIGH_PRIORITY_EXTENSIONS = [".ts", ".js", ".py", ".json", ".yaml", ".yml"];

/**
 * Git command executor interface for dependency injection
 */
export interface GitExecutor {
  execute(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }>;
}

/**
 * Default git executor using child_process
 */
export class DefaultGitExecutor implements GitExecutor {
  constructor(private readonly workingDirectory?: string) {}

  async execute(
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string }> {
    return execAsync(command, {
      cwd: cwd ?? this.workingDirectory,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    });
  }
}

/**
 * Parse git log output into Commit objects
 */
function parseGitLog(output: string): Commit[] {
  if (!output.trim()) {
    return [];
  }

  const commits: Commit[] = [];
  const commitBlocks = output.split("\n\nCOMMIT_SEPARATOR\n\n").filter(Boolean);

  for (const block of commitBlocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 4) continue;

    const hash = lines[0];
    const timestamp = new Date(lines[1]);
    const author = lines[2];
    const message = lines[3];

    // Parse file changes (remaining lines)
    const filesChanged: FileChange[] = [];
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = line.match(/^([AMD])\t(.+)$/);
      if (match) {
        const changeTypeMap: Record<string, FileChange["changeType"]> = {
          A: "added",
          M: "modified",
          D: "deleted",
        };
        filesChanged.push({
          path: match[2],
          changeType: changeTypeMap[match[1]] ?? "modified",
        });
      }
    }

    commits.push({
      hash,
      timestamp,
      author,
      message,
      filesChanged,
    });
  }

  return commits;
}

/**
 * Parse git diff output into FileDiff objects
 */
function parseGitDiff(output: string, commitHash: string): CommitDiff {
  const files: FileDiff[] = [];
  const fileSections = output.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split("\n");
    const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/);
    if (!headerMatch) continue;

    const path = headerMatch[2];
    let additions = 0;
    let deletions = 0;
    const patchLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++;
        patchLines.push(line);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions++;
        patchLines.push(line);
      } else if (line.startsWith("@@") || line.startsWith(" ")) {
        patchLines.push(line);
      }
    }

    files.push({
      path,
      additions,
      deletions,
      patch: patchLines.join("\n"),
    });
  }

  return { commitHash, files };
}


/**
 * Check if a file path matches RAG-related patterns
 */
function isRagRelatedFile(filePath: string): boolean {
  return RAG_RELATED_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Calculate probability score for a commit based on files changed
 */
function calculateCommitProbability(
  commit: Commit,
  ragRelatedFiles: string[]
): number {
  if (commit.filesChanged.length === 0) {
    return 0;
  }

  const ragFileCount = ragRelatedFiles.length;
  const totalFiles = commit.filesChanged.length;

  // Base probability from RAG file ratio
  let probability = ragFileCount / totalFiles;

  // Boost for high-priority extensions
  const highPriorityCount = commit.filesChanged.filter((f) =>
    HIGH_PRIORITY_EXTENSIONS.some((ext) => f.path.endsWith(ext))
  ).length;
  probability += (highPriorityCount / totalFiles) * 0.2;

  // Boost for config file changes
  const configCount = commit.filesChanged.filter(
    (f) => f.path.includes("config") || f.path.endsWith(".json") || f.path.endsWith(".yaml")
  ).length;
  probability += (configCount / totalFiles) * 0.1;

  // Cap at 1.0
  return Math.min(probability, 1.0);
}

/**
 * Generate reasoning for why a commit might have caused degradation
 */
function generateReasoning(
  commit: Commit,
  ragRelatedFiles: string[],
  degradationType: string
): string {
  if (ragRelatedFiles.length === 0) {
    return `Commit ${commit.hash.slice(0, 7)} does not touch RAG-related files`;
  }

  const fileList = ragRelatedFiles.slice(0, 3).join(", ");
  const moreFiles = ragRelatedFiles.length > 3 ? ` and ${ragRelatedFiles.length - 3} more` : "";

  let reason = `Commit ${commit.hash.slice(0, 7)} modifies RAG-related files: ${fileList}${moreFiles}`;

  // Add degradation-specific reasoning
  if (degradationType.includes("retrieval") || degradationType.includes("relevance")) {
    const retrievalFiles = ragRelatedFiles.filter(
      (f) => /retriev|search|index|vector|embed/i.test(f)
    );
    if (retrievalFiles.length > 0) {
      reason += `. Changes to retrieval components may affect relevance scores.`;
    }
  }

  if (degradationType.includes("latency")) {
    reason += `. Code changes may have introduced performance regressions.`;
  }

  if (degradationType.includes("generation") || degradationType.includes("error")) {
    const genFiles = ragRelatedFiles.filter((f) => /generat|prompt|llm|model/i.test(f));
    if (genFiles.length > 0) {
      reason += `. Changes to generation components may affect output quality.`;
    }
  }

  return reason;
}

/**
 * Code Correlator implementation
 */
export class CodeCorrelatorImpl implements CodeCorrelator {
  private readonly gitExecutor: GitExecutor;

  constructor(gitExecutor?: GitExecutor) {
    this.gitExecutor = gitExecutor ?? new DefaultGitExecutor();
  }

  /**
   * Find commits within a time window
   * Implements Requirements 2.1
   */
  async getCommitsInWindow(start: Date, end: Date): Promise<Commit[]> {
    // Validate time window
    if (start >= end) {
      return [];
    }

    const afterDate = start.toISOString();
    const beforeDate = end.toISOString();

    // Git log format: hash, date, author, subject, followed by file changes
    const format = "%H%n%aI%n%an%n%s";
    const command = `git log --after="${afterDate}" --before="${beforeDate}" --format="${format}" --name-status`;

    try {
      const { stdout } = await this.gitExecutor.execute(command);

      // Handle empty output (no commits in window)
      if (!stdout.trim()) {
        return [];
      }

      // Check if output already contains COMMIT_SEPARATOR (from tests)
      let normalizedOutput: string;
      if (stdout.includes("COMMIT_SEPARATOR")) {
        normalizedOutput = stdout;
      } else {
        // Split by double newline to separate commits, then add separator
        normalizedOutput = stdout
          .split(/\n\n(?=[a-f0-9]{40}\n)/i)
          .join("\n\nCOMMIT_SEPARATOR\n\n");
      }

      return parseGitLog(normalizedOutput);
    } catch (error) {
      // Handle case where git is not available or not a git repo
      if (error instanceof Error) {
        if (
          error.message.includes("not a git repository") ||
          error.message.includes("git: not found")
        ) {
          return [];
        }
      }
      throw error;
    }
  }

  /**
   * Rank commits by likelihood of causing degradation
   * Implements Requirements 2.2, 2.3
   */
  async rankCommits(
    commits: Commit[],
    degradationType: string
  ): Promise<RankedCommit[]> {
    const rankedCommits: RankedCommit[] = [];

    for (const commit of commits) {
      // Identify RAG-related files in this commit
      const ragRelatedFiles = commit.filesChanged
        .filter((f) => isRagRelatedFile(f.path))
        .map((f) => f.path);

      // Calculate probability
      const probability = calculateCommitProbability(commit, ragRelatedFiles);

      // Generate reasoning
      const reasoning = generateReasoning(commit, ragRelatedFiles, degradationType);

      rankedCommits.push({
        commit,
        probability,
        ragRelatedFiles,
        reasoning,
      });
    }

    // Sort by probability descending (highest likelihood first)
    // For equal probabilities, sort by timestamp descending (most recent first)
    rankedCommits.sort((a, b) => {
      if (b.probability !== a.probability) {
        return b.probability - a.probability;
      }
      return b.commit.timestamp.getTime() - a.commit.timestamp.getTime();
    });

    return rankedCommits;
  }

  /**
   * Get diff preview for a commit
   */
  async getCommitDiff(commitHash: string): Promise<CommitDiff> {
    const command = `git show ${commitHash} --format="" --patch`;

    try {
      const { stdout } = await this.gitExecutor.execute(command);
      return parseGitDiff(stdout, commitHash);
    } catch (error) {
      // Return empty diff if commit not found
      if (error instanceof Error && error.message.includes("unknown revision")) {
        return { commitHash, files: [] };
      }
      throw error;
    }
  }
}


/**
 * Code Correlator type definitions
 */

import type { FileChange } from "./core.js";

// Git commit record
export interface Commit {
  hash: string;
  timestamp: Date;
  author: string;
  message: string;
  filesChanged: FileChange[];
}

// Ranked commit with probability assessment
export interface RankedCommit {
  commit: Commit;
  probability: number; // 0-1 likelihood of causing issue
  ragRelatedFiles: string[];
  reasoning: string;
}

// Commit diff information
export interface CommitDiff {
  commitHash: string;
  files: FileDiff[];
}

// Individual file diff
export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
}

// Code Correlator interface
export interface CodeCorrelator {
  // Find commits within a time window
  getCommitsInWindow(start: Date, end: Date): Promise<Commit[]>;

  // Rank commits by likelihood of causing degradation
  rankCommits(commits: Commit[], degradationType: string): Promise<RankedCommit[]>;

  // Get diff preview for a commit
  getCommitDiff(commitHash: string): Promise<CommitDiff>;
}

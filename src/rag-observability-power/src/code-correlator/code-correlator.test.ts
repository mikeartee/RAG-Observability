/**
 * Code Correlator Tests
 *
 * Tests for the CodeCorrelator implementation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

import type { Commit, FileChange } from "../types/index.js";

import { CodeCorrelatorImpl } from "./code-correlator.js";
import type { GitExecutor } from "./code-correlator.js";

/**
 * Mock Git Executor for testing
 */
class MockGitExecutor implements GitExecutor {
  private responses: Map<string, { stdout: string; stderr: string }> = new Map();
  private errors: Map<string, Error> = new Map();

  setResponse(commandPattern: string, stdout: string, stderr = ""): void {
    this.responses.set(commandPattern, { stdout, stderr });
  }

  setError(commandPattern: string, error: Error): void {
    this.errors.set(commandPattern, error);
  }

  async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    // Check for errors first
    for (const [pattern, error] of this.errors) {
      if (command.includes(pattern)) {
        throw error;
      }
    }

    // Check for matching response
    for (const [pattern, response] of this.responses) {
      if (command.includes(pattern)) {
        return response;
      }
    }

    return { stdout: "", stderr: "" };
  }

  clear(): void {
    this.responses.clear();
    this.errors.clear();
  }
}

/**
 * Create a mock commit for testing
 */
function createMockCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "abc123def456789",
    timestamp: new Date("2024-01-15T10:00:00Z"),
    author: "Test Author",
    message: "Test commit message",
    filesChanged: [],
    ...overrides,
  };
}

/**
 * Create mock file changes
 */
function createFileChanges(paths: string[]): FileChange[] {
  return paths.map((path) => ({
    path,
    changeType: "modified" as const,
  }));
}

describe("CodeCorrelatorImpl", () => {
  let correlator: CodeCorrelatorImpl;
  let mockExecutor: MockGitExecutor;

  beforeEach(() => {
    mockExecutor = new MockGitExecutor();
    correlator = new CodeCorrelatorImpl(mockExecutor);
  });

  describe("Property-Based Tests", () => {
    describe("Property 5: Commit Time Window Filtering", () => {
      it("should return only commits within the specified time window", () => {
        /**
         * Feature: rag-observability-power, Property 5: Commit Time Window Filtering
         * Validates: Requirements 2.1
         * 
         * For any degradation event with a time window, all commits returned by the 
         * Code Correlator SHALL have timestamps within that window, and no commits 
         * within the window SHALL be omitted.
         */
        fc.assert(
          fc.asyncProperty(
            // Generate a time window
            fc.tuple(
              fc.date({ min: new Date("2020-01-01"), max: new Date("2025-01-01") }),
              fc.date({ min: new Date("2020-01-01"), max: new Date("2025-01-01") })
            ).map(([date1, date2]) => ({
              start: date1 < date2 ? date1 : date2,
              end: date1 < date2 ? date2 : date1,
            })),
            // Generate commits with various timestamps
            fc.array(
              fc.record({
                hash: fc.hexaString({ minLength: 40, maxLength: 40 }),
                timestamp: fc.date({ min: new Date("2019-01-01"), max: new Date("2026-01-01") }),
                author: fc.string({ minLength: 1, maxLength: 50 }),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                filesChanged: fc.array(
                  fc.record({
                    path: fc.string({ minLength: 1, maxLength: 100 }),
                    changeType: fc.constantFrom("added" as const, "modified" as const, "deleted" as const),
                  }),
                  { minLength: 0, maxLength: 10 }
                ),
              }),
              { minLength: 0, maxLength: 20 }
            ),
            async ({ start, end }, allCommits: Commit[]) => {
              // Skip if invalid time window
              if (start >= end) {
                return;
              }

              // Create mock executor that returns only commits within the window
              const mockExecutor = new MockGitExecutor();
              
              // Filter commits to only those within the window (simulating git log behavior)
              // Use inclusive boundaries: start <= timestamp <= end
              const commitsInWindow = allCommits.filter(commit => 
                commit.timestamp.getTime() >= start.getTime() && commit.timestamp.getTime() <= end.getTime()
              );
              
              // Format commits as git log output (only if there are commits)
              const gitOutput = commitsInWindow.length > 0 ? commitsInWindow.map(commit => {
                const fileChanges = commit.filesChanged.map(f => {
                  const changeChar = f.changeType === "added" ? "A" : f.changeType === "deleted" ? "D" : "M";
                  return `${changeChar}\t${f.path}`;
                }).join("\n");
                
                return `${commit.hash}\n${commit.timestamp.toISOString()}\n${commit.author}\n${commit.message}${fileChanges ? "\n" + fileChanges : ""}`;
              }).join("\n\nCOMMIT_SEPARATOR\n\n") : "";

              mockExecutor.setResponse("git log", gitOutput);
              
              const correlator = new CodeCorrelatorImpl(mockExecutor);
              const result = await correlator.getCommitsInWindow(start, end);

              // Determine which commits should be in the window
              const expectedCommits = commitsInWindow;

              // Verify all returned commits are within the window
              for (const commit of result) {
                expect(commit.timestamp.getTime()).toBeGreaterThanOrEqual(start.getTime());
                expect(commit.timestamp.getTime()).toBeLessThanOrEqual(end.getTime());
              }

              // Verify no commits within the window are omitted
              // (This is harder to test with mocked git, but we can verify the count matches)
              expect(result.length).toBe(expectedCommits.length);

              // Verify the commits are the expected ones (by hash)
              const resultHashes = new Set(result.map(c => c.hash));
              const expectedHashes = new Set(expectedCommits.map(c => c.hash));
              expect(resultHashes).toEqual(expectedHashes);

              // Verify commit data integrity
              for (const commit of result) {
                const originalCommit = commitsInWindow.find(c => c.hash === commit.hash);
                expect(originalCommit).toBeDefined();
                if (originalCommit) {
                  expect(commit.author).toBe(originalCommit.author);
                  expect(commit.message).toBe(originalCommit.message);
                  expect(commit.filesChanged.length).toBe(originalCommit.filesChanged.length);
                }
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it("should rank commits consistently with RAG-related files higher", () => {
        /**
         * Feature: rag-observability-power, Property 6: Commit Ranking Consistency
         * Validates: Requirements 2.2, 2.3
         * 
         * For any set of commits being ranked, commits touching RAG-related files 
         * SHALL be ranked higher than commits not touching RAG-related files, and 
         * the ranking SHALL be deterministic for the same input.
         */
        fc.assert(
          fc.asyncProperty(
            // Generate commits with various file changes
            fc.array(
              fc.record({
                hash: fc.hexaString({ minLength: 40, maxLength: 40 }),
                timestamp: fc.date({ min: new Date("2020-01-01"), max: new Date("2024-01-01") }),
                author: fc.string({ minLength: 1, maxLength: 50 }),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                filesChanged: fc.array(
                  fc.record({
                    path: fc.oneof(
                      // RAG-related files
                      fc.constantFrom(
                        "src/retrieval/search.ts",
                        "src/embedding/vectorize.ts", 
                        "src/generation/prompt.ts",
                        "src/rag/index.ts",
                        "src/context/builder.ts",
                        "src/vector/store.ts",
                        "config/model.json"
                      ),
                      // Non-RAG files
                      fc.constantFrom(
                        "src/utils/helper.ts",
                        "README.md",
                        "package.json",
                        "src/auth/login.ts",
                        "src/ui/button.tsx",
                        "tests/unit.test.ts"
                      ),
                      // Random files
                      fc.string({ minLength: 1, maxLength: 50 }).map(s => `src/${s}.ts`)
                    ),
                    changeType: fc.constantFrom("added" as const, "modified" as const, "deleted" as const),
                  }),
                  { minLength: 1, maxLength: 5 }
                ),
              }),
              { minLength: 2, maxLength: 10 }
            ),
            fc.string({ minLength: 1, maxLength: 50 }), // degradationType
            async (commits: Commit[], degradationType: string) => {
              const correlator = new CodeCorrelatorImpl();
              
              // Rank commits twice to test determinism
              const ranking1 = await correlator.rankCommits(commits, degradationType);
              const ranking2 = await correlator.rankCommits(commits, degradationType);

              // Verify deterministic ranking - same input produces same output
              expect(ranking1.map(r => r.commit.hash)).toEqual(ranking2.map(r => r.commit.hash));
              expect(ranking1.map(r => r.probability)).toEqual(ranking2.map(r => r.probability));

              // Categorize commits by whether they touch RAG-related files
              const ragRelatedCommits: string[] = [];
              const nonRagCommits: string[] = [];

              for (const ranked of ranking1) {
                if (ranked.ragRelatedFiles.length > 0) {
                  ragRelatedCommits.push(ranked.commit.hash);
                } else {
                  nonRagCommits.push(ranked.commit.hash);
                }
              }

              // Verify RAG-related commits are ranked higher
              // Find the lowest-ranked RAG commit and highest-ranked non-RAG commit
              let lowestRagIndex = -1;
              let highestNonRagIndex = -1;

              for (let i = 0; i < ranking1.length; i++) {
                const ranked = ranking1[i];
                if (ranked.ragRelatedFiles.length > 0) {
                  lowestRagIndex = i; // Keep updating to find the lowest (last) RAG commit
                }
                if (ranked.ragRelatedFiles.length === 0 && highestNonRagIndex === -1) {
                  highestNonRagIndex = i; // First non-RAG commit is the highest ranked
                }
              }

              // If we have both RAG and non-RAG commits, verify ordering
              if (ragRelatedCommits.length > 0 && nonRagCommits.length > 0) {
                expect(lowestRagIndex).toBeLessThan(highestNonRagIndex);
              }

              // Verify probability values are consistent with ranking
              for (let i = 0; i < ranking1.length - 1; i++) {
                const current = ranking1[i];
                const next = ranking1[i + 1];
                
                // Current should have higher or equal probability than next
                expect(current.probability).toBeGreaterThanOrEqual(next.probability);
                
                // If probabilities are equal, should be sorted by timestamp (more recent first)
                if (current.probability === next.probability) {
                  expect(current.commit.timestamp.getTime()).toBeGreaterThanOrEqual(next.commit.timestamp.getTime());
                }
              }

              // Verify all probabilities are in valid range [0, 1]
              for (const ranked of ranking1) {
                expect(ranked.probability).toBeGreaterThanOrEqual(0);
                expect(ranked.probability).toBeLessThanOrEqual(1);
              }

              // Verify RAG-related files are correctly identified
              for (const ranked of ranking1) {
                for (const ragFile of ranked.ragRelatedFiles) {
                  // Should be one of the files changed in this commit
                  const fileExists = ranked.commit.filesChanged.some(f => f.path === ragFile);
                  expect(fileExists).toBe(true);
                  
                  // Should match RAG patterns
                  const isRagRelated = /retriev|search|index|vector|embed|chunk|generat|prompt|llm|model|complet|rag|context|document|knowledge|config/i.test(ragFile);
                  expect(isRagRelated).toBe(true);
                }
              }

              // Verify reasoning is provided for all commits
              for (const ranked of ranking1) {
                expect(ranked.reasoning).toBeTruthy();
                expect(ranked.reasoning.length).toBeGreaterThan(0);
                expect(ranked.reasoning).toContain(ranked.commit.hash.slice(0, 7));
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe("getCommitsInWindow", () => {
    it("should return empty array when start >= end", async () => {
      const start = new Date("2024-01-15T12:00:00Z");
      const end = new Date("2024-01-15T10:00:00Z");

      const commits = await correlator.getCommitsInWindow(start, end);

      expect(commits).toEqual([]);
    });

    it("should return empty array when no commits in window", async () => {
      mockExecutor.setResponse("git log", "");

      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-31T23:59:59Z");

      const commits = await correlator.getCommitsInWindow(start, end);

      expect(commits).toEqual([]);
    });

    it("should parse commits from git log output", async () => {
      const gitOutput = `abc123def456789
2024-01-15T10:00:00+00:00
John Doe
Add retrieval module
M\tsrc/retrieval/index.ts
A\tsrc/retrieval/search.ts

COMMIT_SEPARATOR

def456abc789012
2024-01-14T09:00:00+00:00
Jane Smith
Update config
M\tconfig/settings.json`;

      mockExecutor.setResponse("git log", gitOutput);

      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-31T23:59:59Z");

      const commits = await correlator.getCommitsInWindow(start, end);

      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe("abc123def456789");
      expect(commits[0].author).toBe("John Doe");
      expect(commits[0].message).toBe("Add retrieval module");
      expect(commits[0].filesChanged).toHaveLength(2);
      expect(commits[0].filesChanged[0].changeType).toBe("modified");
      expect(commits[0].filesChanged[1].changeType).toBe("added");
    });

    it("should return empty array when not a git repository", async () => {
      mockExecutor.setError("git log", new Error("fatal: not a git repository"));

      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-31T23:59:59Z");

      const commits = await correlator.getCommitsInWindow(start, end);

      expect(commits).toEqual([]);
    });
  });

  describe("rankCommits", () => {
    it("should rank commits with RAG-related files higher", async () => {
      const commits: Commit[] = [
        createMockCommit({
          hash: "commit1",
          filesChanged: createFileChanges(["src/utils/helper.ts"]),
        }),
        createMockCommit({
          hash: "commit2",
          filesChanged: createFileChanges(["src/retrieval/search.ts"]),
        }),
        createMockCommit({
          hash: "commit3",
          filesChanged: createFileChanges(["src/embedding/vectorize.ts"]),
        }),
      ];

      const ranked = await correlator.rankCommits(commits, "retrieval_failure");

      // RAG-related commits should be ranked higher
      expect(ranked[0].commit.hash).not.toBe("commit1");
      expect(ranked[0].probability).toBeGreaterThan(0);
      expect(ranked[0].ragRelatedFiles.length).toBeGreaterThan(0);
    });

    it("should return deterministic ranking for same input", async () => {
      const commits: Commit[] = [
        createMockCommit({
          hash: "commit1",
          filesChanged: createFileChanges(["src/retrieval/index.ts"]),
        }),
        createMockCommit({
          hash: "commit2",
          filesChanged: createFileChanges(["src/search/query.ts"]),
        }),
      ];

      const ranked1 = await correlator.rankCommits(commits, "relevance_degradation");
      const ranked2 = await correlator.rankCommits(commits, "relevance_degradation");

      expect(ranked1.map((r) => r.commit.hash)).toEqual(
        ranked2.map((r) => r.commit.hash)
      );
    });

    it("should identify RAG-related files correctly", async () => {
      const commits: Commit[] = [
        createMockCommit({
          hash: "commit1",
          filesChanged: createFileChanges([
            "src/retrieval/search.ts",
            "src/embedding/vectorize.ts",
            "src/generation/prompt.ts",
            "src/utils/helper.ts",
          ]),
        }),
      ];

      const ranked = await correlator.rankCommits(commits, "retrieval_failure");

      expect(ranked[0].ragRelatedFiles).toContain("src/retrieval/search.ts");
      expect(ranked[0].ragRelatedFiles).toContain("src/embedding/vectorize.ts");
      expect(ranked[0].ragRelatedFiles).toContain("src/generation/prompt.ts");
      expect(ranked[0].ragRelatedFiles).not.toContain("src/utils/helper.ts");
    });

    it("should generate meaningful reasoning", async () => {
      const commits: Commit[] = [
        createMockCommit({
          hash: "abc123def",
          filesChanged: createFileChanges(["src/retrieval/search.ts"]),
        }),
      ];

      const ranked = await correlator.rankCommits(commits, "retrieval_failure");

      expect(ranked[0].reasoning).toContain("abc123d");
      expect(ranked[0].reasoning).toContain("RAG-related files");
    });

    it("should handle commits with no RAG-related files", async () => {
      const commits: Commit[] = [
        createMockCommit({
          hash: "commit1",
          filesChanged: createFileChanges(["README.md", "package.json"]),
        }),
      ];

      const ranked = await correlator.rankCommits(commits, "retrieval_failure");

      expect(ranked[0].ragRelatedFiles).toHaveLength(0);
      expect(ranked[0].reasoning).toContain("does not touch RAG-related files");
    });

    it("should handle empty commits array", async () => {
      const ranked = await correlator.rankCommits([], "retrieval_failure");

      expect(ranked).toEqual([]);
    });
  });

  describe("getCommitDiff", () => {
    it("should parse diff output correctly", async () => {
      const diffOutput = `diff --git a/src/retrieval/search.ts b/src/retrieval/search.ts
index abc123..def456 100644
--- a/src/retrieval/search.ts
+++ b/src/retrieval/search.ts
@@ -10,6 +10,8 @@ export function search() {
   const query = "test";
+  const newLine = "added";
+  const anotherLine = "also added";
-  const removed = "gone";
   return results;
 }`;

      mockExecutor.setResponse("git show", diffOutput);

      const diff = await correlator.getCommitDiff("abc123");

      expect(diff.commitHash).toBe("abc123");
      expect(diff.files).toHaveLength(1);
      expect(diff.files[0].path).toBe("src/retrieval/search.ts");
      expect(diff.files[0].additions).toBe(2);
      expect(diff.files[0].deletions).toBe(1);
    });

    it("should return empty diff for unknown commit", async () => {
      mockExecutor.setError("git show", new Error("fatal: unknown revision"));

      const diff = await correlator.getCommitDiff("nonexistent");

      expect(diff.commitHash).toBe("nonexistent");
      expect(diff.files).toEqual([]);
    });
  });
});


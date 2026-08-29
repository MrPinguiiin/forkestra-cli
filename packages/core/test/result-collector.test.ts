import { describe, expect, test } from "bun:test";
import { formatRunSummary, summarizeTasks } from "../src/result-collector";

describe("result collector", () => {
  test("summarizes task statuses and review metadata", () => {
    const summary = summarizeTasks("run-1", [{ id: "task-1", runId: "run-1", status: "completed", agent: "opencode", model: "m", branchName: "feature/task-1", logCount: 2, checkStatus: "passed" }]);
    expect(summary.completed).toBe(1);
    expect(formatRunSummary(summary)).toContain("check=passed");
  });
});

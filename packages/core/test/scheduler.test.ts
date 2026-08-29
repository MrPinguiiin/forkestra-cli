import { describe, expect, test } from "bun:test";
import { runScheduledTasks } from "../src/scheduler";
import type { PlannedTask } from "../src/types";

const task = (id: string, dependsOn: string[] = []): PlannedTask => ({
  id,
  domain: "shared",
  title: id,
  description: id,
  dependsOn,
  agent: "opencode",
  model: "test",
  status: "pending",
  branchName: `feature/${id}`,
});

describe("scheduler", () => {
  test("runs independent tasks in parallel and dependent tasks afterward", async () => {
    const order: string[] = [];
    const result = await runScheduledTasks([task("a"), task("b"), task("c", ["a", "b"])], {
      repoPath: process.cwd(), workspaceRoot: ".tmp", useWorktree: false, commitResults: false, concurrency: 2,
      executor: async (item) => { order.push(item.id); return { exitCode: 0, stdout: "", stderr: "" }; },
    });
    expect(result.completed.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(order.indexOf("c")).toBeGreaterThan(order.indexOf("a"));
    expect(order.indexOf("c")).toBeGreaterThan(order.indexOf("b"));
  });

  test("skips downstream tasks after a failure", async () => {
    const result = await runScheduledTasks([task("failed"), task("downstream", ["failed"])], {
      repoPath: process.cwd(), workspaceRoot: ".tmp", useWorktree: false, commitResults: false,
      executor: async (item) => ({ exitCode: item.id === "failed" ? 1 : 0, stdout: "", stderr: "" }),
    });
    expect(result.failed.map((item) => item.id)).toEqual(["failed"]);
    expect(result.skipped.map((item) => item.id)).toEqual(["downstream"]);
  });

  test("rejects dependency cycles", async () => {
    await expect(runScheduledTasks([task("a", ["b"]), task("b", ["a"])], {
      repoPath: process.cwd(), workspaceRoot: ".tmp", useWorktree: false, commitResults: false,
    })).rejects.toThrow("Dependency cycle detected");
  });
});

import { describe, expect, test } from "bun:test";
import { runScheduledTasks } from "../src/scheduler";
import type { PlannedTask } from "../src/types";

const makeTask = (id: string, agent: PlannedTask["agent"]): PlannedTask => ({ id, domain: "shared", title: id, description: id, dependsOn: [], agent, model: "test", status: "pending", branchName: `feature/${id}` });

describe("scheduler provider limits", () => {
  test("limits active tasks per agent", async () => {
    let active = 0;
    let maximum = 0;
    const result = await runScheduledTasks([makeTask("a", "opencode"), makeTask("b", "opencode"), makeTask("c", "codex")], {
      repoPath: process.cwd(), workspaceRoot: ".tmp", useWorktree: false, commitResults: false, concurrency: 3, concurrencyByAgent: { opencode: 1 },
      executor: async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Bun.sleep(5);
        active -= 1;
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    expect(result.failed).toEqual([]);
    expect(maximum).toBe(2);
  });
});

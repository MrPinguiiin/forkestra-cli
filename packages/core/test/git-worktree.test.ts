import { describe, expect, test } from "bun:test";
import { worktreePathFor } from "../src/git-worktree";
import type { PlannedTask } from "../src/types";

const task: PlannedTask = {
  id: "shared-01",
  domain: "shared",
  title: "Shared",
  description: "Shared task",
  dependsOn: [],
  agent: "opencode",
  model: "test",
  status: "pending",
  branchName: "feature/shared-01",
};

describe("git worktree", () => {
  test("creates a deterministic task path", () => {
    expect(worktreePathFor(task, "/tmp/worktrees/")).toBe("/tmp/worktrees/task-shared-01");
  });
});

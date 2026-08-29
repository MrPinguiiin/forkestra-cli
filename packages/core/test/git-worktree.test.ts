import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitTaskResult, createWorktree, worktreePathFor } from "../src/git-worktree";
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

  test("does not create an empty commit", async () => {
    const repository = await mkdtemp(join(tmpdir(), "forkestra-repo-"));
    const init = Bun.spawn(["git", "init", "-q"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    expect(await init.exited).toBe(0);
    const result = await commitTaskResult(task, repository);
    expect(result).toBe(false);
    await rm(repository, { recursive: true, force: true });
  });

  test("creates an isolated worktree in a fixture repository", async () => {
    const repository = await mkdtemp(join(tmpdir(), "forkestra-repo-"));
    const workspace = await mkdtemp(join(tmpdir(), "forkestra-worktrees-"));
    const init = Bun.spawn(["git", "init", "-q", "-b", "main"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    expect(await init.exited).toBe(0);
    const commit = Bun.spawn(["git", "-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "--allow-empty", "-m", "init"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    expect(await commit.exited).toBe(0);
    const path = await createWorktree(task, { repoPath: repository, workspaceRoot: workspace });
    expect(path).toBe(join(workspace, "task-shared-01"));
    const branch = Bun.spawn(["git", "branch", "--show-current"], { cwd: path, stdout: "pipe", stderr: "pipe" });
    expect((await new Response(branch.stdout).text()).trim()).toBe(task.branchName);
    const cleanup = Bun.spawn(["git", "worktree", "remove", "--force", path], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    expect(await cleanup.exited).toBe(0);
    await rm(repository, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  });
});

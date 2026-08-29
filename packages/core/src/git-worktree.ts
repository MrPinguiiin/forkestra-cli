import { exists } from "node:fs/promises";
import type { PlannedTask } from "./types";

export type WorktreeOptions = {
  repoPath: string;
  workspaceRoot: string;
};

async function runGit(args: string[], cwd: string) {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  const exitCode = await process.exited;

  if (exitCode !== 0) {
    throw new Error(stderr || stdout || `git ${args.join(" ")} failed`);
  }

  return stdout.trim();
}

export function worktreePathFor(task: PlannedTask, workspaceRoot: string) {
  return `${workspaceRoot.replace(/\/$/, "")}/task-${task.id}`;
}

export async function createWorktree(task: PlannedTask, options: WorktreeOptions) {
  const path = worktreePathFor(task, options.workspaceRoot);
  if (await exists(path)) throw new Error(`Worktree path already exists: ${path}`);
  try {
    await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${task.branchName}`], options.repoPath);
    throw new Error(`Branch already exists: ${task.branchName}`);
  } catch (error) {
    if (error instanceof Error && !error.message.includes("failed")) throw error;
  }
  await runGit(["rev-parse", "--is-inside-work-tree"], options.repoPath);
  await runGit(["worktree", "add", path, "-b", task.branchName], options.repoPath);
  return path;
}

export async function removeWorktree(path: string, repoPath: string) {
  await runGit(["worktree", "remove", path, "--force"], repoPath);
}

export async function commitTaskResult(task: PlannedTask, worktreePath: string) {
  const changes = await runGit(["status", "--porcelain"], worktreePath);
  if (!changes) return false;
  await runGit(["add", "."], worktreePath);
  await runGit(["commit", "-m", `feat: complete ${task.id}`], worktreePath);
  return true;
}

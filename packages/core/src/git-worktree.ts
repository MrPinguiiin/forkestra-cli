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

async function gitRefExists(repoPath: string, ref: string) {
  const process = Bun.spawn(["git", "show-ref", "--verify", "--quiet", ref], { cwd: repoPath, stdout: "ignore", stderr: "ignore" });
  return (await process.exited) === 0;
}

export async function createWorktree(task: PlannedTask, options: WorktreeOptions) {
  const path = worktreePathFor(task, options.workspaceRoot);
  if (await exists(path)) throw new Error(`Worktree path already exists: ${path}`);
  await runGit(["rev-parse", "--is-inside-work-tree"], options.repoPath);
  if (await gitRefExists(options.repoPath, `refs/heads/${task.branchName}`)) {
    throw new Error(`Branch already exists: ${task.branchName}`);
  }
  await runGit(["worktree", "add", path, "-b", task.branchName], options.repoPath);
  return path;
}

export type WorktreeInfo = {
  path: string;
  head: string;
  branch?: string;
};

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const output = await runGit(["worktree", "list", "--porcelain"], repoPath);
  const entries: WorktreeInfo[] = [];
  let current: WorktreeInfo | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length), head: "" };
    } else if (current && line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    }
  }
  if (current) entries.push(current);
  return entries;
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

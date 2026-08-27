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
  await runGit(["worktree", "add", path, "-b", task.branchName], options.repoPath);
  return path;
}

export async function removeWorktree(path: string, repoPath: string) {
  await runGit(["worktree", "remove", path, "--force"], repoPath);
}

export async function commitTaskResult(task: PlannedTask, worktreePath: string) {
  await runGit(["add", "."], worktreePath);
  await runGit(["commit", "-m", `feat: complete ${task.id}`], worktreePath);
}

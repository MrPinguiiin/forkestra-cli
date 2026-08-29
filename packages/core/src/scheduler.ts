import { runAgent, type AgentRunResult } from "./agent-runner";
import { commitTaskResult, createWorktree, removeWorktree } from "./git-worktree";
import type { PlannedTask } from "./types";

export type TaskExecutor = (task: PlannedTask, cwd: string) => Promise<AgentRunResult>;

export type SchedulerOptions = {
  repoPath: string;
  workspaceRoot: string;
  useWorktree: boolean;
  commitResults: boolean;
  timeoutMs?: number;
  concurrency?: number;
  concurrencyByAgent?: Partial<Record<PlannedTask["agent"], number>>;
  retries?: number;
  retryable?: (result: AgentRunResult) => boolean;
  cleanupWorktrees?: boolean;
  checkTask?: (task: PlannedTask, cwd: string) => Promise<AgentRunResult>;
  onTaskAttempt?: (task: PlannedTask, attempt: number) => Promise<void> | void;
  onTaskStart?: (task: PlannedTask, cwd: string) => Promise<void> | void;
  onTaskLog?: (task: PlannedTask, stream: "stdout" | "stderr", content: string) => Promise<void> | void;
  onTaskComplete?: (task: PlannedTask, result: AgentRunResult) => Promise<void> | void;
  onTaskSkipped?: (task: PlannedTask) => Promise<void> | void;
  onTaskCheck?: (task: PlannedTask, check: AgentRunResult) => Promise<void> | void;
  executor?: TaskExecutor;
};

export type SchedulerResult = {
  completed: PlannedTask[];
  failed: PlannedTask[];
  skipped: PlannedTask[];
};

function validateDependencies(tasks: PlannedTask[]) {
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!ids.has(dependency)) throw new Error(`Task ${task.id} depends on unknown task ${dependency}`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const task = tasks.find((item) => item.id === id);
    for (const dependency of task?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
}

async function executeTask(task: PlannedTask, options: SchedulerOptions): Promise<AgentRunResult> {
  const cwd = options.useWorktree ? await createWorktree(task, options) : options.repoPath;
  const taskWithPath = { ...task, worktreePath: cwd };
  await options.onTaskStart?.(taskWithPath, cwd);
  let result: AgentRunResult = { exitCode: 1, stdout: "", stderr: "" };
  const attempts = Math.max(0, options.retries ?? 0) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await options.onTaskAttempt?.(taskWithPath, attempt + 1);
    result = options.executor
      ? await options.executor(taskWithPath, cwd)
      : await runAgent(taskWithPath, {
          cwd,
          prompt: task.description,
          timeoutMs: options.timeoutMs,
          onStdout: (content) => void options.onTaskLog?.(task, "stdout", content),
          onStderr: (content) => void options.onTaskLog?.(task, "stderr", content),
        });
    if (result.exitCode !== 0 && !(options.retryable?.(result) ?? (!result.timedOut && result.exitCode !== 127))) break;
    if (result.exitCode === 0) break;
  }
  if (result.exitCode === 0 && options.checkTask) {
    const checkResult = await options.checkTask(taskWithPath, cwd);
    if (checkResult.exitCode !== 0) result = { ...result, exitCode: checkResult.exitCode, stderr: `${result.stderr}${checkResult.stderr}` };
  }
  if (result.exitCode === 0 && options.commitResults && options.useWorktree) {
    try {
      await commitTaskResult(taskWithPath, cwd);
    } catch (error) {
      result = { ...result, exitCode: 1, stderr: `${result.stderr}${error instanceof Error ? error.message : String(error)}` };
    }
  }
  await options.onTaskComplete?.(taskWithPath, result);
  if (options.cleanupWorktrees && options.useWorktree) {
    try {
      await removeWorktree(cwd, options.repoPath);
    } catch (error) {
      result = { ...result, exitCode: 1, stderr: `${result.stderr}${error instanceof Error ? error.message : String(error)}` };
    }
  }
  return result;
}

export async function runScheduledTasks(tasks: PlannedTask[], options: SchedulerOptions): Promise<SchedulerResult> {
  validateDependencies(tasks);
  const completed = new Set<string>();
  const failed = new Set<string>();
  const skipped = new Set<string>();
  const done: PlannedTask[] = [];
  const failedTasks: PlannedTask[] = [];
  const skippedTasks: PlannedTask[] = [];
  const started = new Set<string>();
  const concurrency = Math.max(1, options.concurrency ?? (tasks.length || 1));

  while (completed.size + failed.size + skipped.size < tasks.length) {
    const newlySkipped = tasks.filter((task) => !started.has(task.id) && !skipped.has(task.id) && task.dependsOn.some((dependency) => failed.has(dependency) || skipped.has(dependency)));
    for (const task of newlySkipped) {
      skipped.add(task.id);
      skippedTasks.push({ ...task, status: "skipped" });
      await options.onTaskSkipped?.(task);
    }

    const ready: PlannedTask[] = [];
    const activeByAgent = new Map<string, number>();
    for (const task of tasks.filter((item) => !started.has(item.id) && !skipped.has(item.id) && item.dependsOn.every((dependency) => completed.has(dependency)))) {
      if (ready.length >= concurrency) break;
      const limit = Math.max(1, options.concurrencyByAgent?.[task.agent] ?? concurrency);
      const active = activeByAgent.get(task.agent) ?? 0;
      if (active >= limit) continue;
      activeByAgent.set(task.agent, active + 1);
      ready.push(task);
    }
    if (ready.length === 0) {
      if (completed.size + failed.size + skipped.size === tasks.length) break;
      throw new Error("Scheduler reached a dependency deadlock");
    }

    for (const task of ready) started.add(task.id);
    const results = await Promise.all(ready.map(async (task) => ({ task, result: await executeTask(task, options) })));
    for (const { task, result } of results) {
      if (result.exitCode === 0) {
        completed.add(task.id);
        done.push({ ...task, status: "completed" });
      } else {
        failed.add(task.id);
        failedTasks.push({ ...task, status: "failed" });
      }
    }
  }
  return { completed: done, failed: failedTasks, skipped: skippedTasks };
}

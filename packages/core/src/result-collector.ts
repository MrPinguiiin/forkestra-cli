import type { PlannedTask } from "./types";

export type TaskSummary = {
  id: string;
  runId?: string;
  status: PlannedTask["status"];
  agent: PlannedTask["agent"];
  model: string;
  branchName: string;
  worktreePath?: string;
  logPath?: string;
  logCount?: number;
  checkStatus?: "not-run" | "passed" | "failed";
};

export type RunSummary = {
  runId: string;
  completed: number;
  failed: number;
  skipped: number;
  pending: number;
  running: number;
  tasks: TaskSummary[];
};

export function summarizeTasks(runId: string, tasks: TaskSummary[]): RunSummary {
  return {
    runId,
    completed: tasks.filter((task) => task.status === "completed").length,
    failed: tasks.filter((task) => task.status === "failed").length,
    skipped: tasks.filter((task) => task.status === "skipped").length,
    pending: tasks.filter((task) => task.status === "pending").length,
    running: tasks.filter((task) => task.status === "running").length,
    tasks,
  };
}

export function formatRunSummary(summary: RunSummary) {
  const lines = [`run ${summary.runId}`, `completed=${summary.completed} failed=${summary.failed} skipped=${summary.skipped} pending=${summary.pending} running=${summary.running}`];
  for (const task of summary.tasks) {
    lines.push(`${task.id} ${task.status} agent=${task.agent} model=${task.model} branch=${task.branchName} worktree=${task.worktreePath ?? "-"} logs=${task.logCount ?? 0} check=${task.checkStatus ?? "not-run"}`);
  }
  return lines.join("\n");
}

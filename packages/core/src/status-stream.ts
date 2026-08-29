export type StatusTask = {
  id: string;
  title: string;
  status: string;
  agent: string | null;
  model: string | null;
};

export type StatusSnapshot = {
  runId: string;
  runStatus: string;
  tasks: StatusTask[];
  selectedTaskId?: string;
  logs?: string[];
};

export function formatStatusSnapshot(snapshot: StatusSnapshot) {
  const lines = [`run ${snapshot.runId} ${snapshot.runStatus}`, ""];
  for (const task of snapshot.tasks) {
    const marker = task.status === "completed" ? "[x]" : task.status === "failed" ? "[!]" : task.status === "skipped" ? "[-]" : task.status === "running" ? "[>]" : "[ ]";
    lines.push(`${marker} ${task.id} ${task.title} (${task.agent ?? "unknown"}:${task.model ?? "unknown"})`);
  }
  if (snapshot.selectedTaskId) {
    lines.push("", `logs ${snapshot.selectedTaskId}`);
    lines.push(...(snapshot.logs ?? ["No logs"]));
  }
  return lines.join("\n");
}

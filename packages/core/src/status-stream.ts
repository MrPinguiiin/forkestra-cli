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

export function statusMarker(status: string) {
  return status === "completed" ? "[x]" : status === "failed" ? "[!]" : status === "skipped" ? "[-]" : status === "running" ? "[>]" : "[ ]";
}

export function formatTaskPane(tasks: StatusTask[], selectedTaskId?: string) {
  return tasks.map((task) => `${task.id === selectedTaskId ? ">" : " "} ${statusMarker(task.status)} ${task.id} ${task.title} (${task.agent ?? "unknown"}:${task.model ?? "unknown"})`).join("\n") || "No tasks";
}

export function formatLogPane(selectedTaskId: string | undefined, logs: string[] = []) {
  if (!selectedTaskId) return "No task selected";
  return logs.length > 0 ? logs.join("\n") : "No logs";
}

export function formatStatusSnapshot(snapshot: StatusSnapshot) {
  const lines = [`run ${snapshot.runId} ${snapshot.runStatus}`, "", formatTaskPane(snapshot.tasks, snapshot.selectedTaskId)];
  if (snapshot.selectedTaskId) lines.push("", `logs ${snapshot.selectedTaskId}`, formatLogPane(snapshot.selectedTaskId, snapshot.logs));
  return lines.join("\n");
}

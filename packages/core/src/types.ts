export type SpecSection = {
  title: string;
  slug: string;
  depth: number;
  content: string;
};

export type SpecDocument = {
  path: string;
  raw: string;
  sections: SpecSection[];
};

export type TaskDomain = "frontend" | "backend" | "shared" | "qa";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
export type AgentTool = "claude-code" | "codex" | "opencode";

export type PlannedTask = {
  id: string;
  runId?: string;
  domain: TaskDomain;
  title: string;
  description: string;
  dependsOn: string[];
  agent: AgentTool;
  model: string;
  status: TaskStatus;
  branchName: string;
  worktreePath?: string;
};

export type AgentModelPreset = {
  name: string;
  mapping: Record<TaskDomain, { agent: AgentTool; model: string }>;
};

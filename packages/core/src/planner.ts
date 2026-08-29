import type { AgentModelPreset, AgentTool, PlannedTask, TaskDomain } from "./types";

export const defaultModels: Record<AgentTool, string> = {
  "claude-code": "claude-sonnet-4",
  codex: "gpt-5.2",
  opencode: "anthropic/claude-sonnet-4",
};

export const defaultPreset: AgentModelPreset = {
  name: "Default Split",
  mapping: {
    frontend: { agent: "opencode", model: defaultModels.opencode },
    backend: { agent: "opencode", model: defaultModels.opencode },
    shared: { agent: "opencode", model: defaultModels.opencode },
    qa: { agent: "opencode", model: defaultModels.opencode },
  },
};

export function validatePreset(preset: AgentModelPreset): AgentModelPreset {
  const domains: TaskDomain[] = ["frontend", "backend", "shared", "qa"];
  for (const domain of domains) {
    const selection = preset.mapping[domain];
    if (!selection?.agent || !selection.model) {
      throw new Error(`Preset ${preset.name} must define agent and model for ${domain}`);
    }
    if (!["claude-code", "codex", "opencode"].includes(selection.agent)) {
      throw new Error(`Unsupported agent for ${domain}: ${selection.agent}`);
    }
  }
  return preset;
}

export function planTasks(spec: import("./types").SpecDocument, preset: AgentModelPreset = defaultPreset): PlannedTask[] {
  validatePreset(preset);
  const actionableSections = spec.sections.filter((section) => section.depth <= 3 && section.content.length > 0);
  const counters: Record<TaskDomain, number> = { frontend: 0, backend: 0, shared: 0, qa: 0 };
  const tasks = actionableSections.map((section) => {
    const domain = inferDomain(section.slug);
    counters[domain] += 1;
    const id = `${domain}-${String(counters[domain]).padStart(2, "0")}`;
    const selection = preset.mapping[domain];
    return {
      id,
      domain,
      title: section.title,
      description: section.content,
      dependsOn: [] as string[],
      agent: selection.agent,
      model: selection.model,
      status: "pending" as const,
      branchName: `feature/${id}`,
    };
  });

  const apiTask = tasks.find((task) => task.title.toLowerCase().includes("api contract"));
  if (apiTask) {
    for (const task of tasks) {
      if (task.domain === "frontend" && task.id !== apiTask.id) task.dependsOn.push(apiTask.id);
    }
  }
  return tasks;
}

export function inferDomain(slug: string): TaskDomain {
  if (slug.includes("frontend") || slug.includes("ui") || slug.includes("tui")) return "frontend";
  if (slug.includes("backend") || slug.includes("api") || slug.includes("database") || slug.includes("server")) return "backend";
  if (slug.includes("test") || slug.includes("qa") || slug.includes("verification")) return "qa";
  return "shared";
}

export function formatTaskList(tasks: PlannedTask[]) {
  return tasks.map((task) => {
    const deps = task.dependsOn.length > 0 ? ` depends on ${task.dependsOn.join(", ")}` : "";
    return `${task.id} [${task.domain}] ${task.title} -> ${task.agent}:${task.model}${deps}`;
  }).join("\n");
}

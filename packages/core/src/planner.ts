import type { AgentModelPreset, AgentTool, PlannedTask, SpecDocument, TaskDomain } from "./types";

const defaultModels: Record<AgentTool, string> = {
  "claude-code": "claude-sonnet-4",
  codex: "gpt-5.2",
  opencode: "anthropic/claude-sonnet-4",
};

const defaultPreset: AgentModelPreset = {
  name: "Default Split",
  mapping: {
    frontend: { agent: "opencode", model: defaultModels.opencode },
    backend: { agent: "opencode", model: defaultModels.opencode },
    shared: { agent: "opencode", model: defaultModels.opencode },
    qa: { agent: "opencode", model: defaultModels.opencode },
  },
};

function inferDomain(slug: string): TaskDomain {
  if (slug.includes("frontend") || slug.includes("ui") || slug.includes("tui")) {
    return "frontend";
  }

  if (slug.includes("backend") || slug.includes("api") || slug.includes("database") || slug.includes("server")) {
    return "backend";
  }

  if (slug.includes("test") || slug.includes("qa") || slug.includes("verification")) {
    return "qa";
  }

  return "shared";
}

function taskId(domain: TaskDomain, index: number) {
  return `${domain}-${String(index + 1).padStart(2, "0")}`;
}

export function planTasks(spec: SpecDocument, preset: AgentModelPreset = defaultPreset): PlannedTask[] {
  const actionableSections = spec.sections.filter((section) => section.depth <= 3 && section.content.length > 0);
  const tasks = actionableSections.map((section, index) => {
    const domain = inferDomain(section.slug);
    const selection = preset.mapping[domain];
    const id = taskId(domain, index);

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
      if (task.domain === "frontend" && task.id !== apiTask.id) {
        task.dependsOn.push(apiTask.id);
      }
    }
  }

  return tasks;
}

export function formatTaskList(tasks: PlannedTask[]) {
  return tasks
    .map((task) => {
      const deps = task.dependsOn.length > 0 ? ` depends on ${task.dependsOn.join(", ")}` : "";
      return `${task.id} [${task.domain}] ${task.title} -> ${task.agent}:${task.model}${deps}`;
    })
    .join("\n");
}

import { describe, expect, test } from "bun:test";
import { pullRequestBody } from "../src/pr";
import { defaultPreset, planTasks, validatePreset } from "../src/planner";
import { parseSpec } from "../src/parser";
import type { AgentModelPreset } from "../src/types";

describe("preset validation", () => {
  test("rejects incomplete mappings", () => {
    const preset = { name: "broken", mapping: {} } as unknown as AgentModelPreset;
    expect(() => validatePreset(preset)).toThrow("must define agent and model for frontend");
  });

  test("applies every preset mapping without changing task domains", () => {
    const preset: AgentModelPreset = {
      name: "custom",
      mapping: {
        frontend: { agent: "codex", model: "frontend-model" },
        backend: { agent: "claude-code", model: "backend-model" },
        shared: { agent: "opencode", model: "shared-model" },
        qa: { agent: "codex", model: "qa-model" },
      },
    };
    const tasks = planTasks(parseSpec("# Frontend\n\nUI\n# Backend\n\nAPI\n# QA\n\nTest\n# Docs\n\nDocs", "preset.md"), preset);
    expect(tasks.map(({ domain, agent, model }) => [domain, agent, model])).toEqual([
      ["frontend", "codex", "frontend-model"],
      ["backend", "claude-code", "backend-model"],
      ["qa", "codex", "qa-model"],
      ["shared", "opencode", "shared-model"],
    ]);
  });

  test("default preset provides all domain mappings", () => {
    expect(Object.keys(defaultPreset.mapping).sort()).toEqual(["backend", "frontend", "qa", "shared"]);
  });
});

describe("pull request helpers", () => {
  test("creates a deterministic task body", () => {
    expect(pullRequestBody({ id: "a", domain: "shared", title: "A", description: "Do A", dependsOn: [], agent: "opencode", model: "m", status: "completed", branchName: "feature/a" })).toContain("Task: a");
  });
});

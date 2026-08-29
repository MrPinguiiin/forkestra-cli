import { describe, expect, test } from "bun:test";
import { pullRequestBody } from "../src/pr";
import { validatePreset } from "../src/planner";
import type { AgentModelPreset } from "../src/types";

describe("preset validation", () => {
  test("rejects incomplete mappings", () => {
    const preset = { name: "broken", mapping: {} } as unknown as AgentModelPreset;
    expect(() => validatePreset(preset)).toThrow("must define agent and model for frontend");
  });
});

describe("pull request helpers", () => {
  test("creates a deterministic task body", () => {
    expect(pullRequestBody({ id: "a", domain: "shared", title: "A", description: "Do A", dependsOn: [], agent: "opencode", model: "m", status: "completed", branchName: "feature/a" })).toContain("Task: a");
  });
});

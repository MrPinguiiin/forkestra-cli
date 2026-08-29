import { describe, expect, test } from "bun:test";
import { commandFor } from "../src/agent-runner";
import type { PlannedTask } from "../src/types";

const baseTask: PlannedTask = {
  id: "backend-01",
  domain: "backend",
  title: "Backend",
  description: "Implement API",
  dependsOn: [],
  agent: "opencode",
  model: "provider/model",
  status: "pending",
  branchName: "feature/backend-01",
};

describe("agent runner commands", () => {
  test("builds Claude command", () => {
    expect(commandFor({ ...baseTask, agent: "claude-code", model: "claude-model" }, "prompt")).toEqual({
      cmd: "claude",
      args: ["-p", "prompt", "--model", "claude-model", "--output-format", "json"],
    });
  });

  test("builds Codex command", () => {
    expect(commandFor({ ...baseTask, agent: "codex", model: "codex-model" }, "prompt")).toEqual({
      cmd: "codex",
      args: ["exec", "prompt", "--model", "codex-model"],
    });
  });

  test("builds OpenCode command with domain agent", () => {
    expect(commandFor(baseTask, "prompt")).toEqual({
      cmd: "opencode",
      args: ["run", "--agent", "backend-agent", "-m", "provider/model", "prompt"],
    });
  });
});

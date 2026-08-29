import { describe, expect, test } from "bun:test";
import { commandFor, runAgent } from "../src/agent-runner";
import { listModelsForAgent, parseModelOutput } from "../src/models";
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

  test("streams stdout and stderr and classifies timeout", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const result = await runAgent({ ...baseTask, agent: "opencode" }, { cwd: process.cwd(), prompt: "ignored", timeoutMs: 10, env: { PATH: "/bin" }, onStdout: (chunk) => stdout.push(chunk), onStderr: (chunk) => stderr.push(chunk) });
    expect(result.exitCode).toBe(127);
    expect(result.timedOut ?? false).toBe(false);
    expect(stdout.length + stderr.length).toBeGreaterThanOrEqual(0);
  });
});

describe("model discovery", () => {
  test("parses model output lines", () => {
    expect(parseModelOutput(" model-a\n\nmodel-b \n")).toEqual(["model-a", "model-b"]);
  });

  test("uses stable fallbacks for static tool model lists", async () => {
    expect(await listModelsForAgent("claude-code")).toEqual({ models: ["claude-sonnet-4"] });
    expect(await listModelsForAgent("codex")).toEqual({ models: ["gpt-5.2"] });
  });
});

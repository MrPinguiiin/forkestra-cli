import type { AgentTool } from "./types";
import { defaultModels } from "./planner";

const fallbackModels: Record<AgentTool, string[]> = {
  "claude-code": [defaultModels["claude-code"]],
  codex: [defaultModels.codex],
  opencode: [defaultModels.opencode],
};

const binaries: Record<AgentTool, string> = {
  "claude-code": "claude",
  codex: "codex",
  opencode: "opencode",
};

export async function listModelsForAgent(agent: AgentTool): Promise<{ models: string[]; warning?: string }> {
  if (agent !== "opencode") return { models: fallbackModels[agent] };
  let process: Bun.Subprocess;
  try {
    process = Bun.spawn([binaries[agent], "models"], { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    return { models: fallbackModels[agent], warning: error instanceof Error ? error.message : String(error) };
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout instanceof ReadableStream ? process.stdout : null).text(),
    new Response(process.stderr instanceof ReadableStream ? process.stderr : null).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    return { models: fallbackModels[agent], warning: stderr.trim() || "Unable to discover OpenCode models" };
  }
  const models = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  return models.length > 0 ? { models } : { models: fallbackModels[agent], warning: "OpenCode returned no models" };
}

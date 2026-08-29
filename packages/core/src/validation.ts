import type { AgentTool } from "./types";

const binaries: Record<AgentTool, string> = {
  "claude-code": "claude",
  codex: "codex",
  opencode: "opencode",
};

export async function commandExists(command: string) {
  const process = Bun.spawn(["which", command], {
    stdout: "ignore",
    stderr: "ignore",
  });

  return (await process.exited) === 0;
}

export async function validateAgentTools(agents: AgentTool[]) {
  const uniqueAgents = [...new Set(agents)];
  const missing: string[] = [];

  for (const agent of uniqueAgents) {
    const binary = binaries[agent];
    if (!(await commandExists(binary))) {
      missing.push(binary);
    }
  }

  return missing;
}

import type { AgentTool, PlannedTask } from "./types";

export type AgentRunOptions = {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

export type AgentRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

export function commandFor(task: PlannedTask, prompt: string): { cmd: string; args: string[] } {
  const commands: Record<AgentTool, { cmd: string; args: string[] }> = {
    "claude-code": { cmd: "claude", args: ["-p", prompt, "--model", task.model, "--output-format", "json"] },
    codex: { cmd: "codex", args: ["exec", prompt, "--model", task.model] },
    opencode: { cmd: "opencode", args: ["run", "--agent", `${task.domain}-agent`, "-m", task.model, prompt] },
  };
  return commands[task.agent];
}

async function readStream(stream: ReadableStream<Uint8Array> | null, onChunk?: (chunk: string) => void) {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    output += chunk;
    onChunk?.(chunk);
  }
  return output;
}

export async function runAgent(task: PlannedTask, options: AgentRunOptions): Promise<AgentRunResult> {
  const { cmd, args } = commandFor(task, options.prompt);
  let process: Bun.Subprocess;
  try {
    process = Bun.spawn([cmd, ...args], { cwd: options.cwd, env: options.env, stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    return { exitCode: 127, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
  let timedOut = false;
  const killTimeout = options.timeoutMs ? setTimeout(() => { timedOut = true; process.kill(); }, options.timeoutMs) : undefined;
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(process.stdout instanceof ReadableStream ? process.stdout : null, options.onStdout),
    readStream(process.stderr instanceof ReadableStream ? process.stderr : null, options.onStderr),
    process.exited,
  ]);
  if (killTimeout) clearTimeout(killTimeout);
  return { exitCode: timedOut ? 124 : exitCode, stdout, stderr, timedOut };
}

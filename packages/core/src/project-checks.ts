import { exists } from "node:fs/promises";

export type ProjectCheck = { name: string; command: string; exitCode: number; stdout: string; stderr: string; durationMs: number };

export async function detectProjectChecks(cwd: string, includeBuild = false): Promise<string[]> {
  const path = `${cwd}/package.json`;
  if (!(await exists(path))) return [];
  const packageJson = await Bun.file(path).json() as { scripts?: Record<string, string> };
  const names = ["lint", "check-types", "typecheck", "test"];
  if (includeBuild) names.push("build");
  return names.filter((name) => packageJson.scripts?.[name]).map((name) => `bun run ${name}`);
}

export async function runProjectCheck(command: string, cwd: string): Promise<ProjectCheck> {
  const started = Date.now();
  const process = Bun.spawn(command.trim().split(/\s+/), { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { name: command, command, exitCode, stdout, stderr, durationMs: Date.now() - started };
}

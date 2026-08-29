import type { PlannedTask } from "./types";

export type PullRequestOptions = {
  cwd: string;
  baseBranch: string;
  title: string;
  body: string;
};

export type PullRequestResult = {
  url: string;
};

export async function createGitHubPullRequest(options: PullRequestOptions): Promise<PullRequestResult> {
  const process = Bun.spawn(["gh", "pr", "create", "--base", options.baseBranch, "--title", options.title, "--body", options.body], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(process.stdout instanceof ReadableStream ? process.stdout : null).text();
  const stderr = await new Response(process.stderr instanceof ReadableStream ? process.stderr : null).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || "GitHub pull request creation failed");
  const url = stdout.trim().split("\n").at(-1);
  if (!url) throw new Error("GitHub CLI returned no pull request URL");
  return { url };
}

export function pullRequestBody(task: PlannedTask) {
  return [`Task: ${task.id}`, `Domain: ${task.domain}`, `Agent: ${task.agent}`, `Model: ${task.model}`, "", task.description].join("\n");
}

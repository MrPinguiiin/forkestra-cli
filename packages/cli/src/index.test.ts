import { describe, expect, test } from "bun:test";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

const repoRoot = process.cwd();
const cliPath = join(repoRoot, "packages/cli/src/index.ts");
const sourceDatabase = join(repoRoot, "packages/db/local.db");

describe("CLI integration", () => {
  test("dry-run persists planned tasks without starting an agent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forkestra-cli-"));
    const database = join(directory, "test.db");
    const spec = join(directory, "spec.md");
    await cp(sourceDatabase, database);
    await writeFile(spec, "# Backend\n\nImplement the API.\n", "utf8");
    const initialConnection = new Database(database);
    const initialCount = (initialConnection.query("select count(*) as count from task;").get() as { count: number }).count;
    initialConnection.close();
    try {
      const process = Bun.spawn(["bun", cliPath, "run", spec, "--dry-run"], {
        cwd: repoRoot,
        env: { ...Bun.env, DATABASE_URL: `file:${database}`, DATABASE_AUTH_TOKEN: "" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("dry run complete");
      expect(stdout).toContain("Backend");
      expect(stderr).not.toContain("Missing required agent CLI");
      const connection = new Database(database);
      const count = connection.query("select count(*) as count from task;").get() as { count: number };
      connection.close();
      expect(count.count).toBe(initialCount + 1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("persists, reads, updates, and lists a custom preset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forkestra-preset-"));
    const database = join(directory, "test.db");
    await cp(sourceDatabase, database);
    const env = { ...Bun.env, DATABASE_URL: `file:${database}`, DATABASE_AUTH_TOKEN: "" };
    const mapping = JSON.stringify({
      frontend: { agent: "codex", model: "frontend-v1" },
      backend: { agent: "claude-code", model: "backend-v1" },
      shared: { agent: "opencode", model: "shared-v1" },
      qa: { agent: "codex", model: "qa-v1" },
    });
    try {
      const save = Bun.spawn(["bun", cliPath, "config", "preset", "custom-test", "--set", mapping], { cwd: repoRoot, env, stdout: "pipe", stderr: "pipe" });
      expect(await save.exited).toBe(0);
      const read = Bun.spawn(["bun", cliPath, "config", "preset", "custom-test"], { cwd: repoRoot, env, stdout: "pipe", stderr: "pipe" });
      const readOutput = await new Response(read.stdout).text();
      expect(await read.exited).toBe(0);
      expect(readOutput).toContain("frontend-v1");
      const updateMapping = mapping.replace("frontend-v1", "frontend-v2");
      const update = Bun.spawn(["bun", cliPath, "config", "preset", "custom-test", "--set", updateMapping], { cwd: repoRoot, env, stdout: "pipe", stderr: "pipe" });
      expect(await update.exited).toBe(0);
      await writeFile(join(directory, "preset-spec.md"), "# Frontend\n\nBuild the UI.\n", "utf8");
      const run = Bun.spawn(["bun", cliPath, "run", join(directory, "preset-spec.md"), "--dry-run", "--preset", "custom-test"], { cwd: repoRoot, env, stdout: "pipe", stderr: "pipe" });
      expect(await run.exited).toBe(0);
      const runTask = new Database(database).query("select agent, model from task order by rowid desc limit 1;").get() as { agent: string; model: string };
      expect(runTask).toEqual({ agent: "codex", model: "frontend-v2" });
      const list = Bun.spawn(["bun", cliPath, "config", "presets"], { cwd: repoRoot, env, stdout: "pipe", stderr: "pipe" });
      const listOutput = await new Response(list.stdout).text();
      expect(await list.exited).toBe(0);
      expect(listOutput).toContain("custom-test");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

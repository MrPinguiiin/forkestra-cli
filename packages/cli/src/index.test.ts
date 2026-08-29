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
});

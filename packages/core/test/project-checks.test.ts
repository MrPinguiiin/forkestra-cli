import { describe, expect, test } from "bun:test";
import { detectProjectChecks, runProjectCheck } from "../src/project-checks";

describe("project checks", () => {
  test("detects standard scripts from the repository package", async () => {
    const checks = await detectProjectChecks(process.cwd());
    expect(checks).toContain("bun run lint");
  });

  test("returns no checks for a directory without package.json", async () => {
    expect(await detectProjectChecks("/tmp")).toEqual([]);
  });

  test("returns output and failure status from a check", async () => {
    const result = await runProjectCheck("bun -e process.exit(3)", process.cwd());
    expect(result.exitCode).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

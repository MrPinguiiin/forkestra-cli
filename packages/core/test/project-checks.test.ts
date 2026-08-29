import { describe, expect, test } from "bun:test";
import { detectProjectChecks } from "../src/project-checks";

describe("project checks", () => {
  test("detects standard scripts from the repository package", async () => {
    const checks = await detectProjectChecks(process.cwd());
    expect(checks).toContain("bun run lint");
  });

  test("returns no checks for a directory without package.json", async () => {
    expect(await detectProjectChecks("/tmp")).toEqual([]);
  });
});

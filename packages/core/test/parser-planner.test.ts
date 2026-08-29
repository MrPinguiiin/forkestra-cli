import { describe, expect, test } from "bun:test";
import { parseSpec, slugify } from "../src/parser";
import { defaultPreset, planTasks } from "../src/planner";

describe("parser", () => {
  test("extracts sections and content", () => {
    const spec = parseSpec("# Frontend\n\nBuild UI.\n\n## Details\n\nMore details.", "design.md");
    expect(spec.sections).toEqual([
      { title: "Frontend", slug: "frontend", depth: 1, content: "Build UI." },
      { title: "Details", slug: "details", depth: 2, content: "More details." },
    ]);
  });

  test("rejects empty specifications and specifications without headings", () => {
    expect(() => parseSpec("  ", "empty.md")).toThrow("Specification is empty");
    expect(() => parseSpec("plain text", "plain.md")).toThrow("Specification has no headings");
  });

  test("slugifies special characters", () => {
    expect(slugify("API Contract / v1.0!")).toBe("api-contract-v1-0");
  });
});

describe("planner", () => {
  test("assigns deterministic domain IDs and API dependency", () => {
    const spec = parseSpec("# API Contract\n\nDefine API.\n# Frontend\n\nBuild UI.\n# QA\n\nTest it.", "design.md");
    const tasks = planTasks(spec);
    expect(tasks.map(({ id, domain }) => [id, domain])).toEqual([
      ["backend-01", "backend"],
      ["frontend-01", "frontend"],
      ["qa-01", "qa"],
    ]);
    expect(tasks[1]?.dependsOn).toEqual(["backend-01"]);
  });

  test("uses custom preset selections", () => {
    const spec = parseSpec("# Frontend\n\nBuild UI.", "design.md");
    const tasks = planTasks(spec, {
      ...defaultPreset,
      mapping: {
        ...defaultPreset.mapping,
        frontend: { agent: "codex", model: "custom-model" },
      },
    });
    expect(tasks[0]).toMatchObject({ agent: "codex", model: "custom-model" });
  });
});

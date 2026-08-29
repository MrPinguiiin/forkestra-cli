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

  test("parses a single heading with empty content", () => {
    expect(parseSpec("# Overview", "single.md").sections).toEqual([
      { title: "Overview", slug: "overview", depth: 1, content: "" },
    ]);
  });

  test("preserves parent content when nested headings are present", () => {
    const spec = parseSpec("# Parent\n\nParent content.\n\n## Child\n\nChild content.", "nested.md");
    expect(spec.sections[0]).toMatchObject({ title: "Parent", depth: 1, content: "Parent content." });
    expect(spec.sections[1]).toMatchObject({ title: "Child", depth: 2, content: "Child content." });
  });

  test("accepts irregular whitespace around headings and content", () => {
    const spec = parseSpec("\n\n#   API Contract   \n\n\nDefine the API.\n\n", "whitespace.md");
    expect(spec.sections[0]).toEqual({ title: "API Contract", slug: "api-contract", depth: 1, content: "Define the API." });
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

  test("maps every supported domain and falls back to shared", () => {
    const spec = parseSpec("# Frontend\n\nUI work.\n# Backend\n\nServer work.\n# Verification\n\nVerify it.\n# Documentation\n\nDocument it.", "domains.md");
    expect(planTasks(spec).map((item) => item.domain)).toEqual(["frontend", "backend", "qa", "shared"]);
  });

  test("uses case-insensitive API Contract title matching for frontend dependency", () => {
    const tasks = planTasks(parseSpec("# api contract\n\nDefine API.\n# UI\n\nBuild UI.", "api.md"));
    const apiTask = tasks.find((item) => item.title === "api contract");
    const uiTask = tasks.find((item) => item.title === "UI");
    expect(apiTask?.domain).toBe("backend");
    expect(uiTask?.dependsOn).toEqual(apiTask ? [apiTask.id] : []);
  });

  test("produces identical tasks for identical input", () => {
    const spec = parseSpec("# API Contract\n\nDefine API.\n# Frontend\n\nBuild UI.", "design.md");
    expect(planTasks(spec)).toEqual(planTasks(spec));
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
    expect(tasks[0]).toMatchObject({ domain: "frontend", agent: "codex", model: "custom-model", branchName: "feature/frontend-01" });
  });

  test("only references IDs that exist in the planned task list", () => {
    const tasks = planTasks(parseSpec("# API Contract\n\nDefine API.\n# Frontend\n\nBuild UI.", "design.md"));
    const ids = new Set(tasks.map((item) => item.id));
    expect(tasks.flatMap((item) => item.dependsOn).every((dependency) => ids.has(dependency))).toBe(true);
  });
});

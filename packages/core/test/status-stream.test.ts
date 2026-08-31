import { describe, expect, test } from "bun:test";
import { formatLogPane, formatStatusSnapshot, formatTaskPane } from "../src/status-stream";

describe("status stream", () => {
  test("formats task status without relying on color", () => {
    const output = formatStatusSnapshot({
      runId: "run-1",
      runStatus: "running",
      tasks: [
        { id: "a", title: "Build", status: "completed", agent: "opencode", model: "model" },
        { id: "b", title: "Test", status: "failed", agent: "codex", model: "test-model" },
      ],
      selectedTaskId: "b",
      logs: ["[stderr] failed"],
    });
    expect(output).toContain("[x] a Build");
    expect(output).toContain("[!] b Test");
    expect(output).toContain("[stderr] failed");
  });

  test("formats Codex-style task and log panes", () => {
    const tasks = [{ id: "a", title: "Build", status: "running", agent: "opencode", model: "model" }];
    expect(formatTaskPane(tasks, "a")).toContain("> [>] a Build");
    expect(formatLogPane("a", ["stdout: ready"])).toBe("stdout: ready");
    expect(formatLogPane(undefined)).toBe("No task selected");
  });
});

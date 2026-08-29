import { describe, expect, test } from "bun:test";
import { appRouter } from "./index";

const caller = appRouter.createCaller({ requestId: "test" });

describe("API router", () => {
  test("health check returns OK", async () => {
    expect(await caller.healthCheck()).toBe("OK");
  });

  test("rejects empty run IDs", async () => {
    await expect(caller.runById({ runId: "" })).rejects.toThrow();
  });

  test("limits task log query input", async () => {
    await expect(caller.taskLogsByTask({ taskId: "task", limit: 101 })).rejects.toThrow();
  });
});

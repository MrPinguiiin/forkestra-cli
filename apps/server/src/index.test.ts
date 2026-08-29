import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ??= "file:/tmp/forkestra-api-test.db";
process.env.DATABASE_AUTH_TOKEN ??= "";
process.env.CORS_ORIGIN ??= "http://localhost:3000";

const { default: app } = await import("../../../apps/server/src/index");

describe("server endpoints", () => {
  test("returns OK from the health endpoint", async () => {
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  test("sets the configured CORS origin", async () => {
    const response = await app.request("/", { headers: { Origin: "http://localhost:3000" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});

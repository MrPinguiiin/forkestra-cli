import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  return {
    requestId: context.req.header("x-request-id") ?? crypto.randomUUID(),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

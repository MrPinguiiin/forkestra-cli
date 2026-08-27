import { db } from "@forkestra-cli/db";
import { run, task } from "@forkestra-cli/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  runs: publicProcedure.query(() => {
    return db.select().from(run).orderBy(desc(run.createdAt)).limit(20);
  }),
  tasksByRun: publicProcedure.input(z.object({ runId: z.string().min(1) })).query(({ input }) => {
    return db.select().from(task).where(eq(task.runId, input.runId));
  }),
});
export type AppRouter = typeof appRouter;

import { db } from "@forkestra-cli/db";
import { run, task, taskLog } from "@forkestra-cli/db/schema";
import { TRPCError } from "@trpc/server";
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
  tasksByRun: publicProcedure.input(z.object({ runId: z.string().min(1), limit: z.number().int().min(1).max(100).default(100) })).query(({ input }) => {
    return db.select().from(task).where(eq(task.runId, input.runId)).limit(input.limit);
  }),
  runById: publicProcedure.input(z.object({ runId: z.string().min(1) })).query(({ input }) => {
    return db.select().from(run).where(eq(run.id, input.runId)).limit(1).then(([item]) => {
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: `Run not found: ${input.runId}` });
      return item;
    });
  }),
  taskLogsByTask: publicProcedure.input(z.object({ taskId: z.string().min(1), limit: z.number().int().min(1).max(100).default(50) })).query(({ input }) => {
    return db.select().from(taskLog).where(eq(taskLog.taskId, input.taskId)).limit(input.limit);
  }),
  latestRun: publicProcedure.query(() => db.select().from(run).orderBy(desc(run.createdAt)).limit(1)),
  runSummary: publicProcedure.input(z.object({ runId: z.string().min(1) })).query(async ({ input }) => {
    const [runItem] = await db.select().from(run).where(eq(run.id, input.runId)).limit(1);
    if (!runItem) throw new TRPCError({ code: "NOT_FOUND", message: `Run not found: ${input.runId}` });
    const tasks = await db.select().from(task).where(eq(task.runId, input.runId));
    return {
      runId: input.runId,
      total: tasks.length,
      completed: tasks.filter((item) => item.status === "completed").length,
      failed: tasks.filter((item) => item.status === "failed").length,
      skipped: tasks.filter((item) => item.status === "skipped").length,
      pending: tasks.filter((item) => item.status === "pending").length,
      running: tasks.filter((item) => item.status === "running").length,
    };
  }),
});
export type AppRouter = typeof appRouter;

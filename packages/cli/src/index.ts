#!/usr/bin/env bun
import dotenv from "dotenv";
import { loadSpec, formatTaskList, planTasks, runAgent } from "@forkestra-cli/core";

dotenv.config({ path: "apps/server/.env" });
import { Command } from "commander";

const program = new Command();

program.name("forkestra").description("Multi-agent vibe coding CLI orchestrator").version("0.1.0");

program
  .command("plan")
  .description("Parse a design.md file and print deterministic tasks")
  .argument("<spec>", "Path to design.md")
  .action(async (specPath: string) => {
    const spec = await loadSpec(specPath);
    const tasks = planTasks(spec);
    console.log(formatTaskList(tasks));
  });

program
  .command("run")
  .description("Create a run from design.md and optionally execute ready tasks")
  .argument("<spec>", "Path to design.md")
  .option("--execute", "Execute agent commands after planning")
  .option("--cwd <path>", "Working directory for agent commands", process.cwd())
  .option("--timeout <ms>", "Agent timeout in milliseconds", "900000")
  .action(async (specPath: string, options: { execute?: boolean; cwd: string; timeout: string }) => {
    const [{ db }, { run, task, taskLog }, { eq }] = await Promise.all([
      import("@forkestra-cli/db"),
      import("@forkestra-cli/db/schema"),
      import("drizzle-orm"),
    ]);
    const spec = await loadSpec(specPath);
    const tasks = planTasks(spec);
    const [createdRun] = await db.insert(run).values({ specPath }).returning();

    if (!createdRun) {
      throw new Error("Failed to create run");
    }

    await db.insert(task).values(
      tasks.map((plannedTask) => ({
        runId: createdRun.id,
        domain: plannedTask.domain,
        title: plannedTask.title,
        description: plannedTask.description,
        agent: plannedTask.agent,
        model: plannedTask.model,
        status: plannedTask.status,
        branchName: plannedTask.branchName,
        metadata: { dependsOn: plannedTask.dependsOn },
      })),
    );

    console.log(`run ${createdRun.id}`);
    console.log(formatTaskList(tasks));

    if (!options.execute) {
      return;
    }

    const storedTasks = await db.select().from(task).where(eq(task.runId, createdRun.id));

    for (const storedTask of storedTasks) {
      await db.update(task).set({ status: "running" }).where(eq(task.id, storedTask.id));
      const plannedTask = tasks.find((item) => item.title === storedTask.title);

      if (!plannedTask) {
        continue;
      }

      const result = await runAgent(
        { ...plannedTask, id: storedTask.id, runId: createdRun.id },
        {
          cwd: options.cwd,
          prompt: storedTask.description ?? storedTask.title,
          timeoutMs: Number(options.timeout),
          onStdout: (content) => {
            void db.insert(taskLog).values({ taskId: storedTask.id, stream: "stdout", content });
          },
          onStderr: (content) => {
            void db.insert(taskLog).values({ taskId: storedTask.id, stream: "stderr", content });
          },
        },
      );

      await db
        .update(task)
        .set({ status: result.exitCode === 0 ? "completed" : "failed" })
        .where(eq(task.id, storedTask.id));
    }
  });

program
  .command("status")
  .description("Show recent runs and tasks")
  .action(async () => {
    const [{ db }, { run, task }, { desc, eq }] = await Promise.all([
      import("@forkestra-cli/db"),
      import("@forkestra-cli/db/schema"),
      import("drizzle-orm"),
    ]);
    const runs = await db.select().from(run).orderBy(desc(run.createdAt)).limit(5);

    for (const item of runs) {
      console.log(`${item.id} ${item.status} ${item.specPath}`);
      const tasks = await db.select().from(task).where(eq(task.runId, item.id));

      for (const runTask of tasks) {
        console.log(`  ${runTask.id} [${runTask.domain}] ${runTask.status} ${runTask.title}`);
      }
    }
  });

program
  .command("config")
  .description("Print current runtime configuration")
  .action(() => {
    console.log("database: Turso/SQLite");
    console.log("api: Hono + tRPC");
    console.log("tui: OpenTUI");
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

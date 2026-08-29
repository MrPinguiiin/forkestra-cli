#!/usr/bin/env bun
import dotenv from "dotenv";
import {
  defaultPreset,
  formatTaskList,
  listModelsForAgent,
  loadSpec,
  planTasks,
  listWorktrees,
  removeWorktree,
  runProjectCheck,
  formatStatusSnapshot,
  runScheduledTasks,
  validateAgentTools,
  validatePreset,
} from "@forkestra-cli/core";
import { Command } from "commander";

dotenv.config({ path: "apps/server/.env" });

const program = new Command();
program.name("forkestra").description("Multi-agent vibe coding CLI orchestrator").version("0.1.0");

async function loadPreset(name: string | undefined) {
  if (!name || name === defaultPreset.name) return defaultPreset;
  const [{ db }, { agentPreset }, { eq }] = await Promise.all([
    import("@forkestra-cli/db"),
    import("@forkestra-cli/db/schema"),
    import("drizzle-orm"),
  ]);
  const [stored] = await db.select().from(agentPreset).where(eq(agentPreset.name, name)).limit(1);
  if (!stored) throw new Error(`Preset not found: ${name}`);
  return validatePreset({ name: stored.name, mapping: stored.mapping as Parameters<typeof validatePreset>[0]["mapping"] });
}

program.command("plan").description("Parse a design.md file and print deterministic tasks").argument("<spec>", "Path to design.md").option("--preset <name>", "Agent/model preset").action(async (specPath, options) => {
  const tasks = planTasks(await loadSpec(specPath), await loadPreset(options.preset));
  console.log(formatTaskList(tasks));
});

program.command("run").description("Create a run from design.md and optionally execute ready tasks").argument("<spec>", "Path to design.md")
  .option("--execute", "Execute agent commands after planning")
  .option("--dry-run", "Validate scheduling without running agent commands")
  .option("--worktree", "Create one git worktree per task")
  .option("--commit-results", "Commit successful task results inside each worktree")
  .option("--check", "Run detected project checks after each task")
  .option("--check-command <command>", "Run an explicit project check after each task")
  .option("--skip-checks", "Skip project checks")
  .option("--preset <name>", "Agent/model preset")
  .option("--repo <path>", "Target repository path", process.cwd())
  .option("--workspace-root <path>", "Directory for task worktrees", `${process.cwd()}/.forkestra/worktrees`)
  .option("--timeout <ms>", "Agent timeout in milliseconds", "900000")
  .option("--concurrency <n>", "Maximum parallel tasks", "1")
  .option("--retries <n>", "Retries per failed task", "0")
  .option("--cleanup-worktrees", "Remove task worktrees after execution")
  .action(async (specPath, options) => {
    const [{ db }, { run, task, taskLog }, { eq }] = await Promise.all([
      import("@forkestra-cli/db"),
      import("@forkestra-cli/db/schema"),
      import("drizzle-orm"),
    ]);
    const plannedTasks = planTasks(await loadSpec(specPath), await loadPreset(options.preset));
    const [createdRun] = await db.insert(run).values({ specPath }).returning();
    if (!createdRun) throw new Error("Failed to create run");
    const persistedTasks = await db.insert(task).values(plannedTasks.map((item) => ({
      runId: createdRun.id,
      domain: item.domain,
      title: item.title,
      description: item.description,
      agent: item.agent,
      model: item.model,
      status: item.status,
      branchName: item.branchName,
      metadata: { plannedId: item.id, dependsOn: item.dependsOn },
    }))).returning();
    const persistedByPlannedId = new Map(persistedTasks.map((item) => [String((item.metadata as { plannedId?: string })?.plannedId), item]));
    const tasks = plannedTasks.map((item) => {
      const persisted = persistedByPlannedId.get(item.id);
      return { ...item, id: persisted?.id ?? item.id, runId: createdRun.id, dependsOn: item.dependsOn.map((dependency) => persistedByPlannedId.get(dependency)?.id ?? dependency) };
    });
    console.log(`run ${createdRun.id}`);
    console.log(formatTaskList(tasks));
    if (options.dryRun || !options.execute) {
      console.log(options.dryRun ? "dry run complete" : "planning complete");
      return;
    }
    const missingAgents = await validateAgentTools(tasks.map((item) => item.agent));
    if (missingAgents.length > 0) throw new Error(`Missing required agent CLI: ${missingAgents.join(", ")}`);
    if (options.worktree) await Bun.$`mkdir -p ${options.workspaceRoot}`;
    await db.update(run).set({ status: "running", updatedAt: new Date() }).where(eq(run.id, createdRun.id));
    const result = await runScheduledTasks(tasks, {
      repoPath: options.repo,
      workspaceRoot: options.workspaceRoot,
      useWorktree: !!options.worktree,
      commitResults: !!options.commitResults,
      timeoutMs: Number(options.timeout),
      concurrency: Number(options.concurrency),
      retries: Number(options.retries),
      retryable: (agentResult) => !agentResult.timedOut && agentResult.exitCode !== 127,
      cleanupWorktrees: !!options.cleanupWorktrees,
      onTaskStart: async (item, cwd) => {
        await db.update(task).set({ status: "running", worktreePath: cwd, updatedAt: new Date() }).where(eq(task.id, item.id));
        console.log(`running ${item.id} in ${cwd}`);
      },
      onTaskLog: async (item, stream, content) => { await db.insert(taskLog).values({ taskId: item.id, stream, content }); },
      onTaskSkipped: async (item) => { await db.update(task).set({ status: "skipped", updatedAt: new Date() }).where(eq(task.id, item.id)); },
      onTaskComplete: async (item, agentResult) => {
        const checks = options.skipChecks ? [] : options.checkCommand ? [options.checkCommand] : options.check ? await import("@forkestra-cli/core").then(({ detectProjectChecks }) => detectProjectChecks(options.worktree ? item.worktreePath ?? options.repo : options.repo)) : [];
        let status: "completed" | "failed" = agentResult.exitCode === 0 ? "completed" : "failed";
        for (const check of checks) {
          const checkResult = await runProjectCheck(check, item.worktreePath ?? options.repo);
          await db.insert(taskLog).values({ taskId: item.id, stream: checkResult.exitCode === 0 ? "stdout" : "stderr", content: `[check ${check}]\n${checkResult.stdout}${checkResult.stderr}` });
          if (checkResult.exitCode !== 0) status = "failed";
        }
        await db.update(task).set({ status, updatedAt: new Date() }).where(eq(task.id, item.id));
        console.log(`${item.id} ${status}`);
      },
    });
    const runStatus = result.failed.length === 0 && result.skipped.length === 0 ? "completed" : "failed";
    await db.update(run).set({ status: runStatus, updatedAt: new Date() }).where(eq(run.id, createdRun.id));
    console.log(`summary completed=${result.completed.length} failed=${result.failed.length} skipped=${result.skipped.length}`);
  });

const config = program.command("config").description("Print current runtime configuration");
config.action(() => { console.log("database: Turso/SQLite\napi: Hono + tRPC\ntui: OpenTUI"); });
config.command("models").option("--agent <agent>").action(async (options) => {
  const agents = options.agent ? [options.agent] : ["claude-code", "codex", "opencode"];
  for (const agent of agents) {
    if (!["claude-code", "codex", "opencode"].includes(agent)) throw new Error(`Unsupported agent: ${agent}`);
    const result = await listModelsForAgent(agent);
    console.log(`${agent}: ${result.models.join(", ")}`);
    if (result.warning) console.warn(`warning: ${result.warning}`);
  }
});
config.command("presets").action(async () => {
  const [{ db }, { agentPreset }] = await Promise.all([import("@forkestra-cli/db"), import("@forkestra-cli/db/schema")]);
  console.log(defaultPreset.name);
  for (const preset of await db.select({ name: agentPreset.name }).from(agentPreset)) console.log(preset.name);
});
config.command("worktrees").option("--repo <path>", "Target repository path", process.cwd()).action(async (options) => {
  for (const item of await listWorktrees(options.repo)) console.log(`${item.path} ${item.branch ?? "detached"} ${item.head}`);
});
config.command("remove-worktree").argument("<path>").option("--repo <path>", "Target repository path", process.cwd()).option("--yes", "Skip confirmation").action(async (path, options) => {
  if (!options.yes) throw new Error("Pass --yes to explicitly remove a worktree");
  await removeWorktree(path, options.repo);
  console.log(`worktree removed: ${path}`);
});
config.command("preset").argument("<name>").option("--set <json>").action(async (name, options) => {
  const [{ db }, { agentPreset }, { eq }] = await Promise.all([import("@forkestra-cli/db"), import("@forkestra-cli/db/schema"), import("drizzle-orm")]);
  if (!options.set) { console.log(JSON.stringify(await loadPreset(name), null, 2)); return; }
  const value = validatePreset({ name, mapping: JSON.parse(options.set) });
  const existing = await db.select({ id: agentPreset.id }).from(agentPreset).where(eq(agentPreset.name, name)).limit(1);
  if (existing[0]) await db.update(agentPreset).set({ mapping: value.mapping, updatedAt: new Date() }).where(eq(agentPreset.id, existing[0].id));
  else await db.insert(agentPreset).values({ name, mapping: value.mapping });
  console.log(`preset saved: ${name}`);
});

program.command("status").description("Show recent runs and tasks").action(async () => {
  const [{ db }, { run, task }, { desc, eq }] = await Promise.all([import("@forkestra-cli/db"), import("@forkestra-cli/db/schema"), import("drizzle-orm")]);
  for (const item of await db.select().from(run).orderBy(desc(run.createdAt)).limit(5)) {
    console.log(`${item.id} ${item.status} ${item.specPath}`);
    for (const runTask of await db.select().from(task).where(eq(task.runId, item.id))) console.log(`  ${runTask.id} [${runTask.domain}] ${runTask.status} ${runTask.title}`);
  }
});

program.command("tui").description("Start the OpenTUI status interface").option("--refresh <ms>", "Refresh interval", "1000").action(async (options) => {
  const [{ db }, { run, task, taskLog }, { desc, eq }] = await Promise.all([import("@forkestra-cli/db"), import("@forkestra-cli/db/schema"), import("drizzle-orm")]);
  const [latest] = await db.select().from(run).orderBy(desc(run.createdAt)).limit(1);
  if (!latest) { console.log("No runs available"); return; }
  let selectedTaskId: string | undefined;
  let running = true;
  const stop = () => { running = false; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (running) {
    const tasks = await db.select().from(task).where(eq(task.runId, latest.id));
    selectedTaskId = selectedTaskId && tasks.some((item) => item.id === selectedTaskId) ? selectedTaskId : tasks[0]?.id;
    const logs = selectedTaskId ? await db.select().from(taskLog).where(eq(taskLog.taskId, selectedTaskId)).limit(20) : [];
    process.stdout.write("\\x1b[2J\\x1b[H");
    console.log(formatStatusSnapshot({ runId: latest.id, runStatus: latest.status, selectedTaskId, tasks, logs: logs.map((item) => `[${item.stream}] ${item.content}`) }));
    if (!running) break;
    await Bun.sleep(Math.max(100, Number(options.refresh)));
  }
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
});

program.parseAsync().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

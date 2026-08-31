#!/usr/bin/env bun
import dotenv from "dotenv";
import {
  defaultPreset,
  formatTaskList,
  listModelsForAgent,
  loadSpec,
  planTasks,
  createGitHubPullRequest,
  listWorktrees,
  formatRunSummary,
  pullRequestBody,
  removeWorktree,
  runProjectCheck,
  runScheduledTasks,
  validateAgentTools,
  validatePreset,
  type AgentTool,
  type PlannedTask,
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
   if (!stored) return defaultPreset;
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
  .option("--create-pr", "Create a GitHub pull request for committed task results")
  .option("--base <branch>", "Pull request base branch", "main")
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
    const startedAt = new Map<string, number>();
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
      checkTask: async (item, cwd) => {
        const checks = options.skipChecks ? [] : options.checkCommand ? [options.checkCommand] : options.check ? await import("@forkestra-cli/core").then(({ detectProjectChecks }) => detectProjectChecks(cwd)) : [];
        let result = { exitCode: 0, stdout: "", stderr: "" };
        for (const check of checks) {
          const checkResult = await runProjectCheck(check, cwd);
          result = { exitCode: checkResult.exitCode, stdout: `${result.stdout}${checkResult.stdout}`, stderr: `${result.stderr}${checkResult.stderr}` };
          await db.insert(taskLog).values({ taskId: item.id, stream: checkResult.exitCode === 0 ? "stdout" : "stderr", content: `[check ${check}]\n${checkResult.stdout}${checkResult.stderr}` });
        }
        return result;
      },
      onTaskStart: async (item, cwd) => {
        startedAt.set(item.id, Date.now());
        await db.update(task).set({ status: "running", worktreePath: cwd, updatedAt: new Date() }).where(eq(task.id, item.id));
        console.log(`running ${item.id} in ${cwd}`);
      },
      onTaskLog: async (item, stream, content) => { await db.insert(taskLog).values({ taskId: item.id, stream, content }); },
      onTaskSkipped: async (item) => { await db.update(task).set({ status: "skipped", updatedAt: new Date() }).where(eq(task.id, item.id)); },
      onTaskAttempt: async (item, attempt) => {
        await db.update(task).set({ attemptCount: attempt, updatedAt: new Date() }).where(eq(task.id, item.id));
      },
      onTaskComplete: async (item, agentResult) => {
        const status: "completed" | "failed" = agentResult.exitCode === 0 ? "completed" : "failed";
        await db.update(task).set({ status, exitCode: agentResult.exitCode, durationMs: Date.now() - (startedAt.get(item.id) ?? Date.now()), checkStatus: options.check || options.checkCommand ? (status === "completed" ? "passed" : "failed") : "not-run", updatedAt: new Date() }).where(eq(task.id, item.id));
        if (status === "completed" && options.createPr && options.worktree && options.commitResults && item.worktreePath) {
          const pr = await createGitHubPullRequest({ cwd: item.worktreePath, baseBranch: options.base, title: `feat: complete ${item.id}`, body: pullRequestBody(item) });
          await db.update(task).set({ metadata: { plannedId: item.id, dependsOn: item.dependsOn, pullRequestUrl: pr.url }, updatedAt: new Date() }).where(eq(task.id, item.id));
          console.log(`${item.id} pr=${pr.url}`);
        }
        console.log(`${item.id} ${status}`);
      },
    });
    const runStatus = result.failed.length === 0 && result.skipped.length === 0 ? "completed" : "failed";
    await db.update(run).set({ status: runStatus, updatedAt: new Date() }).where(eq(run.id, createdRun.id));
    const taskSummaries = await db.select().from(task).where(eq(task.runId, createdRun.id));
    const logCounts = await Promise.all(taskSummaries.map(async (item) => ({ id: item.id, count: (await db.select().from(taskLog).where(eq(taskLog.taskId, item.id))).length })));
     const summary = {
       runId: createdRun.id,
       completed: result.completed.length,
       failed: result.failed.length,
       skipped: result.skipped.length,
       pending: 0,
       running: 0,
       tasks: taskSummaries.map((item) => ({
         id: item.id,
         runId: item.runId ?? undefined,
         status: item.status as "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped",
         agent: item.agent as "claude-code" | "codex" | "opencode",
         model: item.model ?? "",
         branchName: item.branchName ?? "",
         worktreePath: item.worktreePath ?? undefined,
         logCount: logCounts.find((count) => count.id === item.id)?.count ?? 0,
         checkStatus: item.checkStatus,
       })),
     };
     console.log(formatRunSummary(summary));
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

program.command("tui").description("Start the OpenTUI status interface").option("--refresh <ms>", "Refresh interval", "1000").action(async (_options) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("TUI requires an interactive terminal; use forkestra status instead");
    return;
  }
  const [{ db }, { run, task, taskLog }, { desc, eq }] = await Promise.all([import("@forkestra-cli/db"), import("@forkestra-cli/db/schema"), import("drizzle-orm")]);
  const { BoxRenderable, TextRenderable, ScrollBoxRenderable, createCliRenderer } = await import("@opentui/core");
  const { formatLogPane, formatTaskPane } = await import("@forkestra-cli/core");
  let [currentRun] = await db.select().from(run).orderBy(desc(run.createdAt)).limit(1);
  if (!currentRun) [currentRun] = await db.insert(run).values({ specPath: "tui-task-mode" }).returning();
  if (!currentRun) throw new Error("Failed to create TUI run");
  const activeRun = currentRun;
  const renderer = await createCliRenderer({ exitOnCtrlC: false, clearOnShutdown: true, useMouse: true, autoFocus: false });
  const screen = new BoxRenderable(renderer, { flexDirection: "column", width: "100%", height: "100%", padding: 1, gap: 1 });
  const header = new BoxRenderable(renderer, { title: "Forkestra", border: true, height: 3 });
  const headerText = new TextRenderable(renderer, { content: "Loading..." });
  const body = new BoxRenderable(renderer, { flexDirection: "row", flexGrow: 1, gap: 1 });
  const taskPane = new ScrollBoxRenderable(renderer, { title: "Tasks", border: true, width: "42%", scrollY: true, focusable: true });
  const detailPane = new ScrollBoxRenderable(renderer, { title: "Task detail", border: true, flexGrow: 1, scrollY: true, focusable: true });
  const logPane = new ScrollBoxRenderable(renderer, { title: "Live output", border: true, height: "38%", scrollY: true, focusable: true, stickyScroll: true, stickyStart: "bottom" });
  const taskText = new TextRenderable(renderer, { content: "Loading..." });
  const detailText = new TextRenderable(renderer, { content: "Loading..." });
  const logText = new TextRenderable(renderer, { content: "Loading..." });
  const commandPane = new BoxRenderable(renderer, { border: true, height: 3, title: "Command" });
  const commandText = new TextRenderable(renderer, { content: "> " });
  header.add(headerText); taskPane.add(taskText); detailPane.add(detailText); logPane.add(logText); commandPane.add(commandText);
  body.add(taskPane); body.add(detailPane); screen.add(header); screen.add(body); screen.add(logPane); screen.add(commandPane); renderer.root.add(screen); renderer.start();
  let selectedIndex = 0;
  let command = "";
  let taskMode = false;
  let running = true;
  let execution: Promise<void> | undefined;
  let notice = "Type /help for commands";
  const stop = () => { running = false; };
  const refresh = () => renderer.requestRender();
  const setNotice = (value: string) => { notice = value; commandText.content = `> ${command}\\n${value}`; refresh(); };
  const taskRow = (event: { y: number }) => Math.max(0, Math.floor(event.y - taskPane.screenY - 1));
  const scroll = (pane: { scrollBy: (delta: { x: number; y: number }) => void }, y: number) => pane.scrollBy({ x: 0, y });
  taskPane.onMouseDown = (event) => { selectedIndex = taskRow(event); refresh(); };
  taskPane.onMouseScroll = (event) => { scroll(taskPane, event.scroll?.direction === "up" ? -3 : 3); refresh(); };
  logPane.onMouseScroll = (event) => { scroll(logPane, event.scroll?.direction === "up" ? -5 : 5); refresh(); };
  detailPane.onMouseScroll = (event) => { scroll(detailPane, event.scroll?.direction === "up" ? -3 : 3); refresh(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const executeRun = async () => {
    if (taskMode) { setNotice("Close task mode with /task close before /run"); return; }
    if (execution) { setNotice("A run is already active"); return; }
    const rows = await db.select().from(task).where(eq(task.runId, activeRun.id));
    const byPlannedId = new Map(rows.map((row) => [String((row.metadata as { plannedId?: string } | null)?.plannedId ?? row.id), row.id]));
    const planned: PlannedTask[] = rows.map((row) => ({ id: row.id, runId: row.runId ?? undefined, domain: row.domain, title: row.title, description: row.description ?? "", dependsOn: ((row.metadata as { dependsOn?: string[] } | null)?.dependsOn ?? []).map((id) => byPlannedId.get(id) ?? id), agent: (row.agent ?? "opencode") as AgentTool, model: row.model ?? "", status: row.status, branchName: row.branchName ?? `feature/${row.id}` }));
    execution = (async () => {
      await db.update(run).set({ status: "running", updatedAt: new Date() }).where(eq(run.id, activeRun.id));
      const started = new Map<string, number>();
      const result = await runScheduledTasks(planned, { repoPath: process.cwd(), workspaceRoot: `${process.cwd()}/.forkestra/worktrees`, useWorktree: false, commitResults: false, concurrency: 1,
        onTaskStart: async (item, cwd) => { started.set(item.id, Date.now()); await db.update(task).set({ status: "running", worktreePath: cwd, updatedAt: new Date() }).where(eq(task.id, item.id)); },
        onTaskAttempt: async (item, attempt) => { await db.update(task).set({ attemptCount: attempt, updatedAt: new Date() }).where(eq(task.id, item.id)); },
        onTaskLog: async (item, stream, content) => { await db.insert(taskLog).values({ taskId: item.id, stream, content }); },
        onTaskSkipped: async (item) => { await db.update(task).set({ status: "skipped", updatedAt: new Date() }).where(eq(task.id, item.id)); },
        onTaskComplete: async (item, agentResult) => { await db.update(task).set({ status: agentResult.exitCode === 0 ? "completed" : "failed", exitCode: agentResult.exitCode, durationMs: Date.now() - (started.get(item.id) ?? Date.now()), updatedAt: new Date() }).where(eq(task.id, item.id)); },
      });
      await db.update(run).set({ status: result.failed.length || result.skipped.length ? "failed" : "completed", updatedAt: new Date() }).where(eq(run.id, activeRun.id));
    })().catch((error: unknown) => setNotice(error instanceof Error ? error.message : String(error))).finally(() => { execution = undefined; });
    setNotice("Run started");
  };
  const handleCommand = async (value: string) => {
    const [name, ...args] = value.trim().split(/\\s+/);
    if (name === "/help") setNotice("/cli <agent> [model] | /run | /task on|close|add|edit|delete");
    else if (name === "/cli") { const agent = args[0]; if (!agent || !["claude-code", "codex", "opencode"].includes(agent)) setNotice("Usage: /cli claude-code|codex|opencode [model]"); else { const model = args[1] ?? (agent === "codex" ? "gpt-5.2" : agent === "claude-code" ? "claude-sonnet-4" : "anthropic/claude-sonnet-4"); await db.update(task).set({ agent: agent as AgentTool, model, updatedAt: new Date() }).where(eq(task.id, (await db.select().from(task).where(eq(task.runId, activeRun.id)))[selectedIndex]?.id ?? "")); setNotice(`CLI set to ${agent}:${model}`); } }
    else if (name === "/run") await executeRun();
    else if (name === "/task") { const action = args[0]; if (action === "on") { taskMode = true; setNotice("Task mode ON: /task add, /task edit, /task delete, /task close"); } else if (action === "close" || action === "off") { taskMode = false; setNotice("Task mode OFF"); } else if (!taskMode) setNotice("Enable task mode with /task on"); else { const rows = await db.select().from(task).where(eq(task.runId, activeRun.id)); const selected = rows[selectedIndex]; const payload = args.slice(1).join(" ").split("|").map((part) => part.trim()); if (action === "add" && payload[0] && payload[1] && payload[2]) { const [domain, title, description] = payload; await db.insert(task).values({ runId: activeRun.id, domain: domain as "frontend" | "backend" | "shared" | "qa", title, description, status: "pending", agent: "opencode", model: "anthropic/claude-sonnet-4", branchName: `feature/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` }); setNotice("Task added"); } else if (action === "edit" && selected && payload.length >= 2) { await db.update(task).set({ title: payload[0], description: payload[1], updatedAt: new Date() }).where(eq(task.id, selected.id)); setNotice("Task updated"); } else if (action === "delete" && selected) { await db.delete(task).where(eq(task.id, selected.id)); selectedIndex = Math.max(0, selectedIndex - 1); setNotice("Task deleted"); } else setNotice("Usage: add domain|title|description; edit title|description; delete"); } }
    else if (value.trim()) setNotice("Unknown command; type /help");
  };
  while (running) {
    const [freshRun] = await db.select().from(run).where(eq(run.id, activeRun.id)).limit(1); if (freshRun) currentRun = freshRun;
    const tasks = await db.select().from(task).where(eq(task.runId, activeRun.id)); selectedIndex = Math.min(selectedIndex, Math.max(0, tasks.length - 1)); const selected = tasks[selectedIndex];
    const logs = selected ? await db.select().from(taskLog).where(eq(taskLog.taskId, selected.id)).limit(200) : [];
    headerText.content = `run ${activeRun.id}  status=${currentRun.status}  tasks=${tasks.length}  ${taskMode ? "[TASK MODE]" : ""}`;
    taskText.content = formatTaskPane(tasks.map((item) => ({ id: item.id, title: item.title, status: item.status, agent: item.agent, model: item.model })), selected?.id);
    detailText.content = selected ? [`id: ${selected.id}`, `status: ${selected.status}`, `domain: ${selected.domain}`, `agent: ${selected.agent ?? "unknown"}`, `model: ${selected.model ?? "unknown"}`, `branch: ${selected.branchName ?? "-"}`, `worktree: ${selected.worktreePath ?? "-"}`, "", taskMode ? "Task mode: edit commands only" : "Task mode is off"].join("\\n") : "No task selected";
    logText.content = formatLogPane(selected?.id, logs.map((item) => `[${item.stream}] ${item.content}`)); commandText.content = `> ${command}\\n${notice}`; refresh();
    process.stdin.setRawMode?.(true); process.stdin.resume();
    const key = await new Promise<string>((resolve) => { const onData = (data: Buffer) => { process.stdin.off("data", onData); resolve(data.toString()); }; process.stdin.once("data", onData); });
    process.stdin.setRawMode?.(false);
    if (key === "q" || key === "\\u0003") stop(); else if (key === "\\u001b") { if (taskMode) { taskMode = false; setNotice("Task mode OFF"); } else stop(); } else if (key === "\\u001b[A" || key === "k") selectedIndex = Math.max(0, selectedIndex - 1); else if (key === "\\u001b[B" || key === "j") selectedIndex += 1; else if (key === "\\u001b[5~") scroll(logPane, -8); else if (key === "\\u001b[6~") scroll(logPane, 8); else if (key === "\\r" || key === "\\n") { const value = command; command = ""; await handleCommand(value); } else if (key === "\\u007f" || key === "\\b") command = command.slice(0, -1); else if (!key.startsWith("\\u001b") && key >= " ") command += key;
  }
  process.stdin.setRawMode?.(false); renderer.destroy(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
});

program.parseAsync().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

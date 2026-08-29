import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const run = sqliteTable("run", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  specPath: text("spec_path").notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "failed", "cancelled", "skipped"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const task = sqliteTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    runId: text("run_id").references(() => run.id, { onDelete: "cascade" }),
    domain: text("domain", { enum: ["frontend", "backend", "shared", "qa"] }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    agent: text("agent"),
    model: text("model"),
    status: text("status", { enum: ["pending", "running", "completed", "failed", "cancelled", "skipped"] })
      .notNull()
      .default("pending"),
    worktreePath: text("worktree_path"),
    branchName: text("branch_name"),
    metadata: text("metadata", { mode: "json" }),
    attemptCount: integer("attempt_count").notNull().default(0),
    exitCode: integer("exit_code"),
    durationMs: integer("duration_ms"),
    checkStatus: text("check_status", { enum: ["not-run", "passed", "failed"] }).notNull().default("not-run"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("task_status_idx").on(table.status), index("task_agent_idx").on(table.agent)],
);

export const agentPreset = sqliteTable("agent_preset", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(),
  mapping: text("mapping", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const taskLog = sqliteTable(
  "task_log",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    stream: text("stream").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("task_log_task_id_idx").on(table.taskId)],
);

export const runRelations = relations(run, ({ many }) => ({
  tasks: many(task),
}));

export const taskRelations = relations(task, ({ many, one }) => ({
  run: one(run, {
    fields: [task.runId],
    references: [run.id],
  }),
  logs: many(taskLog),
}));

export const taskLogRelations = relations(taskLog, ({ one }) => ({
  task: one(task, {
    fields: [taskLog.taskId],
    references: [task.id],
  }),
}));

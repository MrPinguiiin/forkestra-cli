CREATE TABLE `task` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`agent` text,
	`model` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`worktree_path` text,
	`branch_name` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_status_idx` ON `task` (`status`);--> statement-breakpoint
CREATE INDEX `task_agent_idx` ON `task` (`agent`);--> statement-breakpoint
CREATE TABLE `task_log` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`task_id` text NOT NULL,
	`stream` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_log_task_id_idx` ON `task_log` (`task_id`);
ALTER TABLE `task` ADD `attempt_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `exit_code` integer;--> statement-breakpoint
ALTER TABLE `task` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `task` ADD `check_status` text DEFAULT 'not-run' NOT NULL;
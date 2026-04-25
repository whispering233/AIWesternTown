CREATE TABLE `debug_logs` (
	`save_id` text NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`world_tick` integer NOT NULL,
	`trace_id` text,
	`request_id` text,
	`npc_id` text,
	`tags_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`save_id`, `record_id`),
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`save_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_debug_logs_save_kind_tick` ON `debug_logs` (`save_id`,`kind`,`world_tick`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_debug_logs_save_trace` ON `debug_logs` (`save_id`,`trace_id`);--> statement-breakpoint
CREATE INDEX `idx_debug_logs_save_request` ON `debug_logs` (`save_id`,`request_id`);
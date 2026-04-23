CREATE TABLE `event_logs` (
	`save_id` text NOT NULL,
	`event_id` text NOT NULL,
	`world_tick` integer NOT NULL,
	`event_type` text NOT NULL,
	`origin_scene_id` text NOT NULL,
	`actor_ids_json` text NOT NULL,
	`target_ids_json` text NOT NULL,
	`tags_json` text NOT NULL,
	`heat_level` text NOT NULL,
	`interrupt_type` text,
	`source_command_id` text,
	`summary` text,
	`payload_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`save_id`, `event_id`),
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`save_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_event_logs_save_tick` ON `event_logs` (`save_id`,`world_tick`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_event_logs_save_heat` ON `event_logs` (`save_id`,`heat_level`,`world_tick`);--> statement-breakpoint
CREATE TABLE `saves` (
	`save_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`world_tick` integer NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_states` (
	`save_id` text PRIMARY KEY NOT NULL,
	`world_tick` integer NOT NULL,
	`current_scene_id` text NOT NULL,
	`run_mode` text NOT NULL,
	`foreground_npc_ids_json` text NOT NULL,
	`near_field_queue_json` text NOT NULL,
	`far_field_backlog_json` text NOT NULL,
	`dialogue_thread_json` text,
	`interrupt_state_json` text,
	`npc_schedule_states_json` text NOT NULL,
	`active_long_actions_json` text NOT NULL,
	`event_window_json` text NOT NULL,
	`player_action_ledger_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`save_id`) ON UPDATE no action ON DELETE cascade
);

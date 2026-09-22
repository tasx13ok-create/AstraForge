CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `approvals_project` ON `approvals` (`project`,`owner`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`event` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_project` ON `audit` (`project`,`owner`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`secret` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_owner_provider` ON `connections` (`owner`,`provider`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_project` ON `messages` (`project`,`owner`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`kind` text NOT NULL,
	`pattern` text NOT NULL,
	`effect` text NOT NULL,
	`scope` text NOT NULL,
	`session` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `policies_project` ON `policies` (`project`,`owner`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`files` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner` ON `projects` (`owner`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`state` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`diagnostics` text DEFAULT '[]' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_project` ON `runs` (`project`,`owner`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`owner` text NOT NULL,
	`message` text NOT NULL,
	`files` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshots_project` ON `snapshots` (`project`,`owner`);
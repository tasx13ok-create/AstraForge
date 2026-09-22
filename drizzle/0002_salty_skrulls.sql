CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`goal` text NOT NULL,
	`state` text NOT NULL,
	`log` text NOT NULL,
	`pending` text,
	`config` text NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`lease` text,
	`lease_expires` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agents_owner_project` ON `agent_runs` (`owner`,`project`);--> statement-breakpoint
CREATE TABLE `browser_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`provider_id` text NOT NULL,
	`secret` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `browser_owner_project` ON `browser_sessions` (`owner`,`project`);--> statement-breakpoint
CREATE TABLE `workspace_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`plugin` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_tool_unique` ON `workspace_tools` (`owner`,`project`,`plugin`);
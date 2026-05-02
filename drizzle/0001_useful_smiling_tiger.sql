CREATE TABLE `device_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voltixUserId` int NOT NULL,
	`deviceName` text,
	`userAgent` text,
	`ipAddress` varchar(64),
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(512) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `servers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voltix_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voltixUserId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`deviceName` text,
	`userAgent` text,
	`ipAddress` varchar(64),
	`lastPingAt` timestamp NOT NULL DEFAULT (now()),
	`isValid` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `voltix_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `voltix_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `voltix_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(128) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`displayName` text,
	`email` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`jellyfinUsername` varchar(255) NOT NULL,
	`jellyfinPassword` varchar(255) NOT NULL,
	`primaryServerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voltix_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `voltix_users_username_unique` UNIQUE(`username`)
);

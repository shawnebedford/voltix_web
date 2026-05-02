ALTER TABLE `voltix_sessions` ADD `tokenRefreshedAt` timestamp;--> statement-breakpoint
ALTER TABLE `voltix_users` ADD `maxConcurrentDevices` int DEFAULT 1 NOT NULL;
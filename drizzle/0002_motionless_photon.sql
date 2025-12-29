ALTER TABLE `accounts` ADD `cookieExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `accounts` ADD `lastSuccessfulSubmission` timestamp;--> statement-breakpoint
ALTER TABLE `accounts` ADD `totalSuccessfulJobs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `totalFailedJobs` int DEFAULT 0 NOT NULL;
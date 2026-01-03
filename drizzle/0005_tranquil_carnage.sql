ALTER TABLE `logs` MODIFY COLUMN `jobId` int;--> statement-breakpoint
ALTER TABLE `logs` ADD `accountId` int;--> statement-breakpoint
ALTER TABLE `logs` ADD `videoId` int;--> statement-breakpoint
ALTER TABLE `logs` ADD `action` enum('manual_comment','ai_comment','job_comment') DEFAULT 'job_comment' NOT NULL;--> statement-breakpoint
ALTER TABLE `logs` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `logs` ADD CONSTRAINT `logs_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `logs` ADD CONSTRAINT `logs_videoId_videos_id_fk` FOREIGN KEY (`videoId`) REFERENCES `videos`(`id`) ON DELETE set null ON UPDATE no action;
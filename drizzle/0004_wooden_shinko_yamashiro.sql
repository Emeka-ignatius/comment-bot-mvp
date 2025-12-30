ALTER TABLE `jobs` ADD `minDelaySeconds` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `jobs` ADD `maxDelaySeconds` int DEFAULT 60;
DROP INDEX "reminder_delivery_uniq";--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD COLUMN "deadline" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_delivery_uniq" ON "reminder_deliveries" USING btree ("object_id","offset_days","deadline");
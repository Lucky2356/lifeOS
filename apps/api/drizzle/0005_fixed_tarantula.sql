CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"object_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"offset_days" integer NOT NULL,
	"delivered_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_delivery_uniq" ON "reminder_deliveries" USING btree ("object_id","offset_days");
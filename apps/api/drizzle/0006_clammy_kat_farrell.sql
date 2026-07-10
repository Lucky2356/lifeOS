CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"object_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sensitivity" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attachments_object_idx" ON "attachments" USING btree ("object_id");
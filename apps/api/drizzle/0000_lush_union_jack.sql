CREATE TABLE "life_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"hlc" text NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" text,
	"owner_user_id" uuid NOT NULL,
	"household_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text NOT NULL,
	"sensitivity" text NOT NULL,
	"valid_from" text,
	"valid_until" text
);
--> statement-breakpoint
CREATE INDEX "life_objects_owner_idx" ON "life_objects" USING btree ("owner_user_id");
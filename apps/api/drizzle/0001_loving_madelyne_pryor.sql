CREATE TABLE "ai_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"global_enabled" boolean NOT NULL,
	"per_module" jsonb NOT NULL,
	"provider" text NOT NULL,
	"share_sensitive" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"hlc" text NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" text,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"context" text NOT NULL,
	"status" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"chosen_option_id" text,
	"expected_outcome" text NOT NULL,
	"actual_outcome" text,
	"decided_at" text
);
--> statement-breakpoint
CREATE TABLE "household_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"hlc" text NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" text,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"assignee_membership_id" uuid,
	"due_at" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"hlc" text NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" text,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"hlc" text NOT NULL,
	"version" integer NOT NULL,
	"deleted_at" text,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "playbook_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"pack_id" text NOT NULL,
	"pack_version" text NOT NULL,
	"playbook_key" text NOT NULL,
	"step_states" jsonb NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"revoked_at" text,
	"last_seen_at" text NOT NULL,
	"user_agent" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"mfa_enabled" boolean NOT NULL,
	"mfa_secret_enc" text,
	"status" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "audit_household_idx" ON "audit_entries" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "decisions_owner_idx" ON "decisions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "household_tasks_household_idx" ON "household_tasks" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_household_idx" ON "memberships" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "progress_owner_idx" ON "playbook_progress" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
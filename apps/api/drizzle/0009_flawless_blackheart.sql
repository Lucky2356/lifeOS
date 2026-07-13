CREATE TABLE "webauthn_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"transports" jsonb,
	"created_at" text NOT NULL,
	CONSTRAINT "webauthn_credentials_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE INDEX "webauthn_user_idx" ON "webauthn_credentials" USING btree ("user_id");
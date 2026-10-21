CREATE TABLE "billing_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"sent_by_id" text,
	"sent_to" text NOT NULL,
	"note_count" integer NOT NULL,
	"overdue_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_sent_by_id_clinicians_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_reminders_practice_idx" ON "billing_reminders" USING btree ("practice_id","created_at");
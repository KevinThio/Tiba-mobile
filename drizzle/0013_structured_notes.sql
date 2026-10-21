ALTER TABLE "notes" ADD COLUMN "kind" text DEFAULT 'progress' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "care" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "dx_code" text;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_dx_code_diagnosis_codes_code_fk" FOREIGN KEY ("dx_code") REFERENCES "public"."diagnosis_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_kind_check" CHECK ("notes"."kind" in ('progress', 'evaluation', 'service_plan', 'oasis'));
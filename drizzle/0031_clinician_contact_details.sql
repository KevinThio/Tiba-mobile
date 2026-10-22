ALTER TABLE "clinician_profiles" ADD COLUMN "experience" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD COLUMN "postal_code" text;
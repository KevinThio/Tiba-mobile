ALTER TABLE "clinicians" ADD COLUMN "role" text DEFAULT 'clinician' NOT NULL;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_role_check" CHECK ("clinicians"."role" in ('clinician', 'admin'));--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_country_check" CHECK ("clinicians"."country" in ('US', 'KE'));
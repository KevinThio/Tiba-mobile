ALTER TABLE "practices" ADD COLUMN "agreement_template" jsonb;--> statement-breakpoint
ALTER TABLE "service_agreements" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "service_agreements" ADD COLUMN "refused" boolean DEFAULT false NOT NULL;
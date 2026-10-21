ALTER TABLE "clinicians" DROP CONSTRAINT "clinicians_country_check";--> statement-breakpoint
ALTER TABLE "practices" DROP CONSTRAINT "practices_country_check";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_country_check" CHECK ("clinicians"."country" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_country_check" CHECK ("practices"."country" ~ '^[A-Z]{2}$');--> statement-breakpoint
-- Invoices made before currencies were stored: use the clinician's country at the time (US or KE).
UPDATE "invoices" SET "currency" = 'KES' FROM "clinicians" WHERE "clinicians"."id" = "invoices"."clinician_id" AND "clinicians"."country" = 'KE';

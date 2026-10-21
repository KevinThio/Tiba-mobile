ALTER TABLE "appointments" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "currency" text;--> statement-breakpoint
-- Fees booked before currencies were stored were in the clinician's country's money (US or KE).
UPDATE "appointments" SET "currency" = 'KES' FROM "clinicians" WHERE "clinicians"."id" = "appointments"."clinician_id" AND "clinicians"."country" = 'KE';

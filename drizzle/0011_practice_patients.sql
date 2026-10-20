ALTER TABLE "patients" ADD COLUMN "practice_id" uuid;--> statement-breakpoint
-- Existing patients belong to their clinician's practice; that clinician added them.
UPDATE "patients" pt SET "practice_id" = c."practice_id"
FROM "clinicians" c WHERE c."id" = pt."clinician_id";--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "practice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "insurer" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "services_ordered" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "ordering_doctor" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referral_date" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "start_of_care" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "added_by_id" text;--> statement-breakpoint
UPDATE "patients" SET "added_by_id" = "clinician_id";--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_added_by_id_clinicians_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."clinicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_practice_id_idx" ON "patients" USING btree ("practice_id");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_status_check" CHECK ("patients"."status" in ('active', 'discharged'));
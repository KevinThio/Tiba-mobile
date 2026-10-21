ALTER TABLE "patients" ADD COLUMN "duplicate_of_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "duplicate_flagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_duplicate_of_id_patients_id_fk" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
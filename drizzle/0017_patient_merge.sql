ALTER TABLE "patients" DROP CONSTRAINT "patients_status_check";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_merged_into_id_patients_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_status_check" CHECK ("patients"."status" in ('active', 'discharged', 'merged'));
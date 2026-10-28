ALTER TABLE "clinicians" DROP CONSTRAINT "clinicians_role_check";--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_owner_kind_check";--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "organisation" text;--> statement-breakpoint
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_role_check" CHECK ("clinicians"."role" in ('clinician', 'admin', 'patient', 'referrer'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_kind_check" CHECK ("files"."owner_kind" in ('clinician', 'clinician_admin', 'patient', 'location', 'message'));
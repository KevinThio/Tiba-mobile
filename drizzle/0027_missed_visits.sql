ALTER TABLE "appointments" ADD COLUMN "missed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "missed_reason" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_missed_has_reason" CHECK (("appointments"."missed_at" is null) = ("appointments"."missed_reason" is null));
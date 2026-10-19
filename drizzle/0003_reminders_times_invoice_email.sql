ALTER TABLE "appointments" ADD COLUMN "time_in" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "time_out" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "reminder_emails" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "clinicians" ADD COLUMN "last_reminder_sent_on" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_to" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "invoice_email" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_out_after_time_in" CHECK ("appointments"."time_out" is null or "appointments"."time_in" is null or "appointments"."time_out" > "appointments"."time_in");--> statement-breakpoint
-- Once a visit's note is signed, the visit's times are part of the legal record: lock them.
CREATE OR REPLACE FUNCTION prevent_signed_visit_time_changes() RETURNS trigger AS $$
BEGIN
  IF (NEW.time_in IS DISTINCT FROM OLD.time_in
      OR NEW.time_out IS DISTINCT FROM OLD.time_out
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at)
     AND EXISTS (SELECT 1 FROM notes WHERE appointment_id = OLD.id AND signed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'The note for visit % is signed, so its times are locked.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER appointments_times_locked_after_signing
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_visit_time_changes();

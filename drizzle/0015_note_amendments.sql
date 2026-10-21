CREATE TABLE "note_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"care" text NOT NULL,
	"fields" jsonb NOT NULL,
	"dx_code" text,
	"body" text NOT NULL,
	"clinician_signature" text NOT NULL,
	"patient_signature" text,
	"signed_at" timestamp with time zone NOT NULL,
	"amendment_reason" text,
	"time_in" timestamp with time zone,
	"time_out" timestamp with time zone,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "amendment_reason" text;--> statement-breakpoint
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_versions_note_version_idx" ON "note_versions" USING btree ("note_id","version");--> statement-breakpoint
-- Earlier signed versions are part of the record: never changed or deleted.
CREATE OR REPLACE FUNCTION prevent_note_version_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Version % of note % is part of the signed record and can''t be changed.', OLD.version, OLD.note_id
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER note_versions_locked
  BEFORE UPDATE OR DELETE ON note_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_note_version_changes();
--> statement-breakpoint
-- Signed notes stay locked, with one way out: reopening the note for an amendment. That is
-- only allowed when the signed version is already copied, unchanged, into note_versions, the
-- note becomes the next version with a reason, and the signatures are cleared for re-signing.
CREATE OR REPLACE FUNCTION prevent_signed_note_changes() RETURNS trigger AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE'
       AND NEW.signed_at IS NULL
       AND NEW.clinician_signature IS NULL
       AND NEW.patient_signature IS NULL
       AND NEW.version = OLD.version + 1
       AND coalesce(trim(NEW.amendment_reason), '') <> ''
       AND NEW.appointment_id = OLD.appointment_id
       AND EXISTS (
         SELECT 1 FROM note_versions v
         WHERE v.note_id = OLD.id AND v.version = OLD.version AND v.signed_at = OLD.signed_at
           AND v.body = OLD.body AND v.fields = OLD.fields AND v.kind = OLD.kind AND v.care = OLD.care
           AND v.dx_code IS NOT DISTINCT FROM OLD.dx_code
           AND v.clinician_signature = OLD.clinician_signature
           AND v.patient_signature IS NOT DISTINCT FROM OLD.patient_signature
           AND v.amendment_reason IS NOT DISTINCT FROM OLD.amendment_reason
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Note % is signed and locked. Amend it, or add an addendum.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

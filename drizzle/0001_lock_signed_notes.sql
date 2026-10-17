-- A signed note is a legal record: block every edit and delete once signed_at is set.
-- Corrections are added as rows in note_addenda instead.
CREATE OR REPLACE FUNCTION prevent_signed_note_changes() RETURNS trigger AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Note % is signed and locked. Add an addendum instead.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER notes_locked_after_signing
  BEFORE UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_note_changes();

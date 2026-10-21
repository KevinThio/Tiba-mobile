-- Addenda are corrections to a signed note, so they're part of the record too: once added,
-- they can't be edited or deleted. They can only be added to a note that's already signed.
CREATE OR REPLACE FUNCTION prevent_addendum_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Addendum % is part of the signed record and can''t be changed.', OLD.id
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER note_addenda_locked
  BEFORE UPDATE OR DELETE ON note_addenda
  FOR EACH ROW EXECUTE FUNCTION prevent_addendum_changes();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION require_signed_note_for_addendum() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notes WHERE id = NEW.note_id AND signed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Addenda can only be added to a signed note.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER note_addenda_signed_only
  BEFORE INSERT ON note_addenda
  FOR EACH ROW EXECUTE FUNCTION require_signed_note_for_addendum();

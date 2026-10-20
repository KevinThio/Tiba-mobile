-- Patient reviews are the patient's words: admins may hide them but never delete them or
-- change what was written. Only seen_at, hidden_at and hidden_by_id may change.
-- Allowed exceptions: the practice itself being removed (its reviews cascade), and
-- clinician_id / hidden_by_id becoming null because that account was removed.
CREATE OR REPLACE FUNCTION protect_reviews() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM practices WHERE id = OLD.practice_id) THEN
      RAISE EXCEPTION 'Patient reviews can''t be deleted. Hide it instead.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.practice_id IS DISTINCT FROM OLD.practice_id
    OR NEW.rating IS DISTINCT FROM OLD.rating
    OR NEW.text IS DISTINCT FROM OLD.text
    OR NEW.name IS DISTINCT FROM OLD.name
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (NEW.clinician_id IS DISTINCT FROM OLD.clinician_id
        AND NOT (NEW.clinician_id IS NULL
                 AND NOT EXISTS (SELECT 1 FROM clinicians WHERE id = OLD.clinician_id)))
  THEN
    RAISE EXCEPTION 'A patient review can''t be changed. Hide it instead.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reviews_protected
  BEFORE UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION protect_reviews();

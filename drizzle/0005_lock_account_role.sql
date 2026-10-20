-- The account type (clinician or admin) is chosen at sign-up and never changes: an admin
-- sees the whole practice, so a clinician must not be able to promote themselves.
CREATE OR REPLACE FUNCTION prevent_account_role_changes() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'The account type of % can''t be changed.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER clinicians_role_locked
  BEFORE UPDATE OF role ON clinicians
  FOR EACH ROW EXECUTE FUNCTION prevent_account_role_changes();

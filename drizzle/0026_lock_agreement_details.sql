-- Service agreements now carry the form's details and can be recorded as refused. Replaces the
-- rule from 0024: once anyone has signed, the wording, details and refusal can't change; a given
-- signature can't be removed or replaced; and a completed agreement (both signatures, or the
-- agency witness recording a refusal) is locked and can't be deleted.
CREATE OR REPLACE FUNCTION prevent_signed_agreement_changes() RETURNS trigger AS $$
DECLARE
  complete boolean := OLD.admin_signature IS NOT NULL AND (OLD.patient_signature IS NOT NULL OR OLD.refused);
  started boolean := OLD.patient_signature IS NOT NULL OR OLD.admin_signature IS NOT NULL;
BEGIN
  IF complete THEN
    RAISE EXCEPTION 'This service agreement is complete and locked.' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' AND started THEN
    RAISE EXCEPTION 'A signed service agreement can''t be deleted.' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       (OLD.patient_signature IS NOT NULL AND NEW.patient_signature IS DISTINCT FROM OLD.patient_signature)
    OR (OLD.admin_signature IS NOT NULL AND NEW.admin_signature IS DISTINCT FROM OLD.admin_signature)
    OR (started AND (NEW.sections IS DISTINCT FROM OLD.sections OR NEW.details IS DISTINCT FROM OLD.details OR NEW.refused IS DISTINCT FROM OLD.refused))
  ) THEN
    RAISE EXCEPTION 'A signed service agreement can''t be changed.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

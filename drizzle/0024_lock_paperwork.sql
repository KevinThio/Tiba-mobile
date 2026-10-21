-- Signed contracts are a record both sides agreed to: once signed, nothing about them changes and
-- they can't be deleted. Drafts and sent contracts can still be edited and resent.
CREATE OR REPLACE FUNCTION prevent_signed_contract_changes() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION 'Contract % is signed and locked.', OLD.label
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contracts_locked_after_signing
  BEFORE UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_changes();
--> statement-breakpoint
-- Contract messages are part of the record: never edited or deleted.
CREATE OR REPLACE FUNCTION prevent_contract_message_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Contract messages can''t be changed.' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contract_messages_locked
  BEFORE UPDATE OR DELETE ON contract_messages
  FOR EACH ROW EXECUTE FUNCTION prevent_contract_message_changes();
--> statement-breakpoint
-- A service agreement signed by both the patient and the admin is locked. A signature, once
-- given, can't be removed or replaced.
CREATE OR REPLACE FUNCTION prevent_signed_agreement_changes() RETURNS trigger AS $$
BEGIN
  IF OLD.patient_signature IS NOT NULL AND OLD.admin_signature IS NOT NULL THEN
    RAISE EXCEPTION 'This service agreement is signed by both sides and locked.' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' AND (OLD.patient_signature IS NOT NULL OR OLD.admin_signature IS NOT NULL) THEN
    RAISE EXCEPTION 'A signed service agreement can''t be deleted.' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       (OLD.patient_signature IS NOT NULL AND NEW.patient_signature IS DISTINCT FROM OLD.patient_signature)
    OR (OLD.admin_signature IS NOT NULL AND NEW.admin_signature IS DISTINCT FROM OLD.admin_signature)
    OR ((OLD.patient_signature IS NOT NULL OR OLD.admin_signature IS NOT NULL) AND NEW.sections IS DISTINCT FROM OLD.sections)
  ) THEN
    RAISE EXCEPTION 'A signature on this service agreement can''t be changed.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER service_agreements_locked
  BEFORE UPDATE OR DELETE ON service_agreements
  FOR EACH ROW EXECUTE FUNCTION prevent_signed_agreement_changes();

-- Clock-ins and clock-outs are the record that a visit happened where and when it did:
-- they can never be changed or deleted. A clock-out needs an earlier clock-in by the visit's
-- clinician, and a visit can't switch between in person and virtual once clocked in.
CREATE OR REPLACE FUNCTION protect_visit_clocks() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Clock-ins and clock-outs can''t be changed or deleted.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM appointments WHERE id = NEW.appointment_id AND clinician_id = NEW.clinician_id) THEN
    RAISE EXCEPTION 'Only the visit''s clinician can clock in or out.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.event = 'out' AND NOT EXISTS (
    SELECT 1 FROM visit_clocks
    WHERE appointment_id = NEW.appointment_id AND event = 'in' AND at < NEW.at AND virtual = NEW.virtual
  ) THEN
    RAISE EXCEPTION 'Clock in before clocking out.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER visit_clocks_protected
  BEFORE INSERT OR UPDATE OR DELETE ON visit_clocks
  FOR EACH ROW EXECUTE FUNCTION protect_visit_clocks();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lock_visit_mode() RETURNS trigger AS $$
BEGIN
  IF NEW.virtual IS DISTINCT FROM OLD.virtual
    AND EXISTS (SELECT 1 FROM visit_clocks WHERE appointment_id = OLD.id) THEN
    RAISE EXCEPTION 'This visit is clocked in, so it can''t switch between in person and virtual.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER appointments_mode_locked
  BEFORE UPDATE OF virtual ON appointments
  FOR EACH ROW EXECUTE FUNCTION lock_visit_mode();

-- A missed visit has no note and can't be invoiced; a visit with a note can't be marked missed.
CREATE OR REPLACE FUNCTION prevent_missed_visit_conflicts() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.missed_at IS NOT NULL AND OLD.missed_at IS NULL
       AND (EXISTS (SELECT 1 FROM notes WHERE appointment_id = NEW.id)
            OR EXISTS (SELECT 1 FROM invoice_items WHERE appointment_id = NEW.id)) THEN
      RAISE EXCEPTION 'Visit % has a note or an invoice, so it can''t be marked missed.', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM appointments WHERE id = NEW.appointment_id AND missed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Visit % was missed, so it has no note or invoice.', NEW.appointment_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER appointments_missed_conflicts
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION prevent_missed_visit_conflicts();
--> statement-breakpoint
CREATE TRIGGER notes_not_for_missed_visits
  BEFORE INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION prevent_missed_visit_conflicts();
--> statement-breakpoint
CREATE TRIGGER invoice_items_not_for_missed_visits
  BEFORE INSERT ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION prevent_missed_visit_conflicts();

import { sql } from "drizzle-orm";
import { patients } from "@/db/schema";

/**
 * Who an invoice is for, for lists: the patient's name, or "3 patients" when it covers visits for
 * several patients (invoices.patient_id is null; the clinician bills the practice). Use with
 * `.leftJoin(patients, eq(patients.id, invoices.patientId))` on a query from `invoices`.
 * The subquery uses written-out table names: Drizzle leaves columns unqualified inside `sql`.
 */
export const invoicePatientLabel = sql<string>`coalesce(${patients.fullName}, (
  select count(distinct a.patient_id) || ' patients'
  from invoice_items i join appointments a on a.id = i.appointment_id
  where i.invoice_id = invoices.id
))`;

import { requireClinician } from "@/lib/auth";
import { practiceBilling } from "@/lib/practice";
import { getCareTypes } from "./actions";
import { AppointmentsView } from "./appointments-view";

export default async function AppointmentsPage() {
  const clinician = await requireClinician();
  const [careTypes, billing] = await Promise.all([getCareTypes(), practiceBilling(clinician.practiceId)]);
  return <AppointmentsView clinicianName={clinician.name} currency={billing.currency} careTypes={careTypes} />;
}

import { requireClinician } from "@/lib/auth";
import { getCareTypes } from "./actions";
import { AppointmentsView } from "./appointments-view";

export default async function AppointmentsPage() {
  const clinician = await requireClinician();
  const careTypes = await getCareTypes();
  return <AppointmentsView clinicianName={clinician.name} careTypes={careTypes} />;
}

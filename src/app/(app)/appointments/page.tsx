import { clinicianSettings } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { practiceBilling } from "@/lib/practice";
import { getCareTypes } from "./actions";
import { AppointmentsView } from "./appointments-view";

export default async function AppointmentsPage() {
  const clinician = await requireClinician();
  const [careTypes, billing, settings] = await Promise.all([
    getCareTypes(),
    practiceBilling(clinician.practiceId),
    clinicianSettings(clinician.id),
  ]);
  // The Settings visit fee, if it's in the currency the practice bills in now.
  const visitFeeMinor = settings.visitFee?.currency === billing.currency ? settings.visitFee.minor : null;
  return (
    <AppointmentsView
      clinicianName={clinician.name}
      currency={billing.currency}
      visitFeeMinor={visitFeeMinor}
      careTypes={careTypes}
    />
  );
}

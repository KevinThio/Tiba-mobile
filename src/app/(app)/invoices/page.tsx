import { requireClinician } from "@/lib/auth";
import { InvoicesView } from "./invoices-view";

export default async function InvoicesPage() {
  const clinician = await requireClinician();
  return <InvoicesView country={clinician.country} />;
}

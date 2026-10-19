import { requireClinician } from "@/lib/auth";
import { InvoicesView } from "./invoices-view";

export default async function InvoicesPage() {
  await requireClinician();
  return <InvoicesView />;
}

import { PageHeader } from "@/components/page-header";
import { DEFAULT_CLAUSES } from "@/lib/agreement-template";
import { practiceAgreementClauses } from "@/lib/agreements";
import { requireAdmin } from "@/lib/auth";
import { AgreementTemplateEditor } from "./template-editor";

/** Settings → Service agreement wording: the clauses every new agreement uses. */
export default async function AgreementWordingPage() {
  const admin = await requireAdmin();
  const clauses = await practiceAgreementClauses(admin.practiceId);
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/settings", label: "Settings" }}
        overline="Your practice"
        title="Service agreement wording"
        description="Every new service agreement uses this wording. Agreements already signed keep the wording they were signed with."
      />
      <AgreementTemplateEditor initial={clauses} defaults={DEFAULT_CLAUSES} />
    </div>
  );
}

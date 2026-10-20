import { FilePenLine } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";

export default async function NotesPage() {
  await requireClinician();
  return (
    <div className="grid gap-8">
      <PageHeader overline="To do" title="Notes to do" description="Finished visits with no note yet, and drafts you've started." />
      <EmptyState icon={FilePenLine} title="Notes to do is coming soon">
        Visits that need a note and your unsigned drafts will be listed here, so nothing gets missed.
      </EmptyState>
    </div>
  );
}

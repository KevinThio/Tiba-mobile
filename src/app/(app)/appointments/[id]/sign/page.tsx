import { and, eq } from "drizzle-orm";
import { PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { appointments, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";

/** Sign note (spec v2): the next screen to build. The draft is saved, so nothing is lost. */
export default async function SignNotePage({ params }: PageProps<"/appointments/[id]/sign">) {
  const clinician = await requireClinician();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [visit] = await db
    .select({ patientName: patients.fullName })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.id, id), eq(appointments.clinicianId, clinician.id)));
  if (!visit) notFound();
  const first = visit.patientName.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader back={{ href: `/appointments/${id}`, label: "Note" }} overline="Sign" title={`Sign ${first}'s note`} />
      <EmptyState
        icon={PenLine}
        title="Signing is coming soon"
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={`/appointments/${id}`} />}>
            Back to the note
          </Button>
        }
      >
        Every section is filled and your draft is saved. Signing with your finger or mouse, and the patient&apos;s signature,
        come with the next screen.
      </EmptyState>
    </div>
  );
}

"use client";

import { ChevronRight, FileCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Row = {
  appointmentId: string;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
  typeOfCare: string;
  startsAt: string;
  billed: boolean;
};

/** Signed notes with a clinician filter; each opens the admin's signed note. */
export function NotesList({ notes, clinicians }: { notes: Row[]; clinicians: { id: string; name: string }[] }) {
  const [clinician, setClinician] = useState("");
  const shown = notes.filter((n) => !clinician || n.clinicianId === clinician);

  if (notes.length === 0) {
    return (
      <EmptyState icon={FileCheck} title="No signed notes yet">
        Notes show here once your clinicians sign them. Drafts stay private to each clinician until signed.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-muted-foreground">
          {shown.length} signed {shown.length === 1 ? "note" : "notes"} · Newest first. Drafts stay private to each clinician
          until signed.
        </p>
        <NativeSelect
          aria-label="Filter by clinician"
          className="w-full sm:w-64"
          value={clinician}
          onChange={(e) => setClinician(e.target.value)}
        >
          <NativeSelectOption value="">All clinicians</NativeSelectOption>
          {clinicians.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label="Signed notes">
        {shown.map((n) => (
          <li key={n.appointmentId} className="border-b border-border-subtle last:border-b-0">
            <Link
              href={`/admin/notes/${n.appointmentId}`}
              className="group flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{n.patientName}</span>
                <span className="block truncate text-small text-muted-foreground">
                  <RelativeDay iso={n.startsAt} /> · {n.clinicianName} · {n.typeOfCare}
                </span>
              </span>
              {n.billed ? <Badge variant="success">Billed</Badge> : <Badge variant="neutral">Not billed</Badge>}
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

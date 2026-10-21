"use client";

import { Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { initialsOf } from "@/components/practice-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setPatientStatus } from "./actions";

type Row = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  status: "active" | "discharged";
  insurer: string | null;
  referralDate: string | null;
  startOfCare: string | null;
  createdAt: string;
  clinicianName: string;
  possibleDuplicate: boolean;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => dateFormat.format(new Date(d));

/** Active and Discharged tabs with search, as in the prototype. */
export function PatientsList({ patients }: { patients: Row[] }) {
  const [tab, setTab] = useState<"active" | "discharged">("active");
  const [query, setQuery] = useState("");
  const counts = {
    active: patients.filter((p) => p.status === "active").length,
    discharged: patients.filter((p) => p.status === "discharged").length,
  };
  const q = query.trim().toLowerCase();
  const shown = patients.filter((p) => p.status === tab && (!q || p.fullName.toLowerCase().includes(q)));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Patients" className="inline-flex w-fit gap-1 rounded-full bg-muted p-1">
          {(["active", "discharged"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "h-10 rounded-full px-4 text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                tab === t ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "active" ? "Active" : "Discharged"} ({counts[t]})
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients"
            aria-label="Search patients"
            className="pl-10"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={q ? "No patients match" : tab === "active" ? "No patients yet" : "No discharged patients"}
          action={
            !q && tab === "active" ? (
              <Button nativeButton={false} render={<Link href="/admin/patients/new" />}>
                Add patient
              </Button>
            ) : undefined
          }
        >
          {q
            ? "Check the spelling, or try part of the name."
            : tab === "active"
              ? "Add your first patient and pick the clinician who will see them."
              : "Patients you discharge show here, and you can reactivate them any time."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
          {shown.map((p) => (
            <PatientRow key={p.id} patient={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PatientRow({ patient: p }: { patient: Row }) {
  const [pending, startTransition] = useTransition();
  const when = p.startOfCare
    ? `Started ${fmt(p.startOfCare)}`
    : p.referralDate
      ? `Referred ${fmt(p.referralDate)}`
      : `Added ${fmt(p.createdAt)}`;
  const next = p.status === "active" ? "discharged" : "active";

  function toggle() {
    startTransition(async () => {
      const result = await setPatientStatus({ patientId: p.id, status: next }).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.message ?? "We couldn't save that change. Check your connection and try again.");
        return;
      }
      toast.success(
        next === "discharged"
          ? `${p.fullName} is moved to discharged patients.`
          : `${p.fullName} is an active patient again.`,
      );
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
        aria-hidden
      >
        {initialsOf(p.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold">{p.fullName}</span>
          {p.possibleDuplicate && <Badge variant="warning">Possible duplicate</Badge>}
        </p>
        <p className="truncate text-small text-muted-foreground">
          {[p.clinicianName, when, p.insurer].filter(Boolean).join(" · ")}
        </p>
      </div>
      {p.possibleDuplicate && (
        <Button size="sm" nativeButton={false} render={<Link href={`/admin/patients/${p.id}/duplicate`} />}>
          Review
        </Button>
      )}
      <Button size="sm" variant={next === "discharged" ? "ghost" : "secondary"} disabled={pending} onClick={toggle}>
        {next === "discharged" ? "Discharge" : "Reactivate"}
      </Button>
    </li>
  );
}

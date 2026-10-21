"use client";

import { ChevronRight, Search, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { initialsOf } from "@/components/practice-mark";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  name: string;
  age: number;
  discharged: boolean;
  isMine: boolean;
  adminChecking: boolean;
  noteToDo: boolean;
  lastVisit: string | null;
};

/** Handed to Add patient so a search with no match can start the form with that name. */
export const NEW_PATIENT_NAME_KEY = "tiba:new-patient-name";

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** At most one letter added, dropped or changed ("amna" finds "amina"). */
function oneEditAway(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** A typed word matches a name part by its start, or with one typo once it's 4+ letters long. */
const wordMatches = (word: string, part: string) =>
  part.startsWith(word) || (word.length >= 4 && (oneEditAway(word, part) || oneEditAway(word, part.slice(0, word.length))));

/**
 * The list with search. Search runs in the browser over the practice list, so the name typed
 * never goes into a URL or a log.
 */
export function PatientsView({ patients }: { patients: Row[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = normalise(query);
    if (!q) return patients;
    return patients.filter((p) => q.split(" ").every((word) => normalise(p.name).split(" ").some((part) => wordMatches(word, part))));
  }, [patients, query]);

  if (patients.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="No patients yet"
        action={
          <Button nativeButton={false} render={<Link href="/patients/new" />}>
            <UserPlus aria-hidden /> Add patient
          </Button>
        }
      >
        Patients you or your admin add show here for everyone in the practice.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative max-w-form">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search patients by name"
          autoComplete="off"
          className="pl-11"
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title={`No one called “${query.trim()}”`}
          action={
            <Button
              nativeButton={false}
              render={<Link href="/patients/new" />}
              onClick={() => {
                try {
                  sessionStorage.setItem(NEW_PATIENT_NAME_KEY, query.trim());
                } catch {}
              }}
            >
              <UserPlus aria-hidden /> Add patient
            </Button>
          }
        >
          Check the spelling, or add them as a new patient.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label="Patients">
          {shown.map((p) => (
            <li key={p.id} className="border-b border-border-subtle last:border-b-0">
              <Link
                href={`/patients/${p.id}`}
                className="group flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
                  aria-hidden
                >
                  {initialsOf(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-small text-muted-foreground">
                    {p.age} ·{" "}
                    {p.lastVisit ? (
                      <>
                        Last visit <RelativeDay iso={p.lastVisit} />
                      </>
                    ) : p.isMine ? (
                      "No visits yet"
                    ) : (
                      "No visits with you yet"
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {p.noteToDo && <Badge variant="warning">Note to do</Badge>}
                  {p.adminChecking && <Badge variant="info">Admin checking</Badge>}
                  {p.discharged && <Badge variant="neutral">Discharged</Badge>}
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

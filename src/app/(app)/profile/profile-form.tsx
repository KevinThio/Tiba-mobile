"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Certification, EducationEntry } from "@/db/schema";
import { DISCIPLINES, type Discipline } from "@/lib/disciplines";
import { CERT_STATUS, certificationStatus, EDUCATION_LEVELS, hasLicence, QUICK_CERTS } from "@/lib/profiles";
import { saveProfile, type ProfileInput } from "./actions";

type Profile = {
  speciality: string;
  licenseNumber: string;
  licenseIssuer: string;
  licenseExpiry: string;
  education: EducationEntry[];
  certifications: Certification[];
};

const newId = () => crypto.randomUUID();

/** Profile (spec v2 section 5c and the prototype): About you, Education, Certifications. */
export function ProfileForm({ discipline: initialDiscipline, profile }: { discipline: Discipline | null; profile: Profile }) {
  const router = useRouter();
  const [discipline, setDiscipline] = useState<string>(initialDiscipline ?? "");
  const [p, setP] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Profile>) => {
    setP((cur) => ({ ...cur, ...patch }));
    if (error) setError(null);
  };
  const editEdu = (id: string, patch: Partial<EducationEntry>) => set({ education: p.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const editCert = (id: string, patch: Partial<Certification>) => set({ certifications: p.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  async function save() {
    if (!discipline) return setError("Pick your discipline.");
    setBusy(true);
    setError(null);
    const result = await saveProfile({ ...p, education: p.education as ProfileInput["education"], discipline: discipline as Discipline }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save your profile. Check your connection and try again.");
    toast.success("Profile saved. Your admin can see it.");
    router.refresh();
  }

  const saveButton = (
    <Button onClick={save} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
      Save profile
    </Button>
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">About you</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="discipline">Discipline</Label>
            <NativeSelect id="discipline" className="w-full" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              {!discipline && <NativeSelectOption value="">Pick your discipline</NativeSelectOption>}
              {DISCIPLINES.map((d) => (
                <NativeSelectOption key={d.value} value={d.value}>
                  {d.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <FormField label="Speciality (optional)" name="speciality" value={p.speciality} onChange={(e) => set({ speciality: e.target.value })} placeholder="e.g. Orthopaedic rehab" />
        </div>
        {hasLicence(discipline || null) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Licence number (optional)" name="licenseNumber" value={p.licenseNumber} onChange={(e) => set({ licenseNumber: e.target.value })} />
            <FormField label="Issued by (optional)" name="licenseIssuer" value={p.licenseIssuer} onChange={(e) => set({ licenseIssuer: e.target.value })} placeholder="e.g. State board" />
            <FormField label="Expires (optional)" name="licenseExpiry" type="date" value={p.licenseExpiry} onChange={(e) => set({ licenseExpiry: e.target.value })} />
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-h3">Education</h2>
          <p className="text-small text-muted-foreground">Every level, from certificates to doctorates.</p>
        </div>
        {p.education.map((e, i) => (
          <fieldset key={e.id} className="grid gap-3 rounded-md border border-border-subtle p-4">
            <legend className="sr-only">Education {i + 1}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
              <div className="grid gap-2">
                <Label htmlFor={`edu-level-${e.id}`}>Level</Label>
                <NativeSelect id={`edu-level-${e.id}`} className="w-full" value={e.level} onChange={(ev) => editEdu(e.id, { level: ev.target.value })}>
                  {EDUCATION_LEVELS.map((l) => (
                    <NativeSelectOption key={l} value={l}>
                      {l}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <FormField label="Course or qualification" name={`edu-course-${e.id}`} value={e.course} onChange={(ev) => editEdu(e.id, { course: ev.target.value })} placeholder="e.g. Doctor of Physical Therapy" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <FormField label="School or college" name={`edu-school-${e.id}`} value={e.school} onChange={(ev) => editEdu(e.id, { school: ev.target.value })} />
              <FormField label="Year completed" name={`edu-year-${e.id}`} inputMode="numeric" maxLength={4} value={e.year} onChange={(ev) => editEdu(e.id, { year: ev.target.value.replace(/\D/g, "") })} />
              <Button variant="ghost" onClick={() => set({ education: p.education.filter((x) => x.id !== e.id) })}>
                <Trash2 aria-hidden /> Remove
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => set({ education: [...p.education, { id: newId(), level: "Bachelor's", course: "", school: "", year: "" }] })}
        >
          <Plus aria-hidden /> Add education
        </Button>
      </section>

      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-h3">Certifications</h2>
          <p className="text-small text-muted-foreground">
            {discipline === "HHA" ? "Aides and CNAs need at least one. Add your HHA or CNA certification." : "Optional. Add BLS, CPR or any others."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Quick add">
          {QUICK_CERTS.filter((q) => !p.certifications.some((c) => c.name === q)).map((q) => (
            <ChoiceChip key={q} size="sm" on={false} onClick={() => set({ certifications: [...p.certifications, { id: newId(), name: q, issuer: "", expiry: "" }] })}>
              <Plus className="size-4" aria-hidden /> {q}
            </ChoiceChip>
          ))}
        </div>
        {p.certifications.map((c, i) => {
          const status = certificationStatus(c.expiry);
          return (
            <fieldset key={c.id} className="grid gap-3 rounded-md border border-border-subtle p-4">
              <legend className="sr-only">Certification {i + 1}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{c.name || "New certification"}</p>
                {status && <Badge variant={CERT_STATUS[status].variant}>{CERT_STATUS[status].label}</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_11rem_auto] sm:items-end">
                <FormField label="Certification" name={`cert-name-${c.id}`} value={c.name} onChange={(ev) => editCert(c.id, { name: ev.target.value })} />
                <FormField label="Issued by" name={`cert-issuer-${c.id}`} value={c.issuer} onChange={(ev) => editCert(c.id, { issuer: ev.target.value })} placeholder="e.g. American Heart Association" />
                <FormField label="Expires" name={`cert-expiry-${c.id}`} type="date" value={c.expiry} onChange={(ev) => editCert(c.id, { expiry: ev.target.value })} />
                <Button variant="ghost" onClick={() => set({ certifications: p.certifications.filter((x) => x.id !== c.id) })}>
                  <Trash2 aria-hidden /> Remove
                </Button>
              </div>
            </fieldset>
          );
        })}
        <Button variant="outline" className="w-fit" onClick={() => set({ certifications: [...p.certifications, { id: newId(), name: "", issuer: "", expiry: "" }] })}>
          <Plus aria-hidden /> Add certification
        </Button>
      </section>

      {error && <FormAlert>{error}</FormAlert>}
      <div>{saveButton}</div>
    </div>
  );
}

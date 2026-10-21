"use client";

import { Check, Copy, Loader2, Lock, PenLine, Save, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { DiagnosisPicker, type DiagnosisOption } from "@/components/diagnosis-picker";
import { FormAlert } from "@/components/form-alert";
import { NoteField } from "@/components/note-fields";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  CARE_LABEL,
  countedFields,
  getTemplate,
  isDiscipline,
  isFilled,
  KIND_LABEL,
  missingFields,
  THERAPY_CARES,
  type Care,
  type Goal,
  type NoteKind,
} from "@/lib/note-templates";
import { cn } from "@/lib/utils";
import { getPrefill, saveNoteDraft, searchNoteDiagnoses, type Prefill } from "./note-actions";

type Props = {
  appointmentId: string;
  patientName: string;
  startsAt: string;
  durationMinutes: number;
  kinds: NoteKind[];
  initial: { kind: NoteKind; care: Care; fields: Record<string, unknown>; dx: DiagnosisOption | null; savedAt: string | null };
  evaluationGoals: { goals: Goal[]; from: string } | null;
  /** The visit times card (time in and out), rendered by the server page. */
  visitTimes: React.ReactNode;
  /** A banner under the header, e.g. while amending a signed note. */
  notice?: React.ReactNode;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const noop = () => () => {};
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Visit note editor (spec v2 sections 4, 4a and 4b, and the prototype): the type of note or care,
 * diagnosis code, sections for that template, progress, autosaved drafts, prefill from the last
 * visit, and Continue to sign.
 */
export function NoteEditor({ appointmentId, patientName, startsAt, durationMinutes, kinds, initial, evaluationGoals, visitTimes, notice }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState(initial.kind);
  const [care, setCare] = useState(initial.care);
  const [fields, setFields] = useState(initial.fields);
  const [dx, setDx] = useState(initial.dx);
  // Bumped on every change; the autosave saves the latest version and knows if more came in.
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>(initial.savedAt ? "saved" : "idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [undo, setUndo] = useState<{ fields: Record<string, unknown>; dx: DiagnosisOption | null; from: string } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const savedVersion = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  // The latest state, for saves that start after a pause or after an earlier save finishes.
  const latest = useRef({ kind, care, fields, dx, version });
  latest.current = { kind, care, fields, dx, version };

  const template = useMemo(() => getTemplate(kind, care), [kind, care]);
  const goalCount = evaluationGoals?.goals.length ?? 0;
  const counted = countedFields(template, goalCount);
  const missing = missingFields(template, fields, goalCount);
  const done = counted.length - missing.length;

  const overline = useSyncExternalStore(
    noop,
    () => {
      const start = new Date(startsAt);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      return `${KIND_LABEL[kind]} · ${DATE.format(start)} · ${TIME.format(start)}–${TIME.format(end)}`;
    },
    () => KIND_LABEL[kind],
  );

  // Autosave: a short pause after the last change saves the draft. A new change restarts the pause.
  useEffect(() => {
    if (version === 0) return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads the latest state from a ref
  }, [version]);

  // Closing or reloading the tab with unsaved changes asks first (the browser shows its own wording).
  const unsaved = version !== savedVersion.current || saveState === "saving";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Leaving the tab (another app, the lock screen) saves straight away: browsers slow down
  // timers in hidden tabs, so the autosave pause might not end before the tab is closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && latest.current.version !== savedVersion.current) void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads the latest state from a ref
  }, []);

  // Prefill from last visit is offered on progress notes (spec v2 section 4b).
  useEffect(() => {
    let cancelled = false;
    if (kind !== "progress") return;
    getPrefill({ appointmentId, kind, care })
      .then((p) => {
        if (!cancelled) setPrefill(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [appointmentId, kind, care]);

  /**
   * Saves the latest state. Saves run one at a time, so an older save can never land after a
   * newer one; changes made while a save is running are saved straight after it.
   */
  async function save(): Promise<boolean> {
    if (inFlight.current) await inFlight.current;
    const snapshot = latest.current;
    if (snapshot.version === savedVersion.current) return true;
    setSaveState("saving");
    const run = saveNoteDraft({
      appointmentId,
      kind: snapshot.kind,
      care: snapshot.care,
      fields: snapshot.fields,
      dxCode: snapshot.dx?.code ?? null,
    })
      .catch(() => null)
      .then((result) => {
        if (!result?.ok) {
          setSaveState("error");
          setSaveError(result?.message ?? "We couldn't save just now. Check your connection; we'll keep trying as you type.");
          return false;
        }
        savedVersion.current = snapshot.version;
        setSaveError(null);
        // Only "saved" if nothing changed while this save was on its way.
        setSaveState(latest.current.version === snapshot.version ? "saved" : "saving");
        return true;
      });
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }


  function change(next: Partial<{ kind: NoteKind; care: Care; dx: DiagnosisOption | null }>) {
    if (next.kind) setKind(next.kind);
    if (next.care) setCare(next.care);
    if (next.dx !== undefined) setDx(next.dx);
    touched();
  }

  /** Updates answers from the latest state, so quick changes never overwrite each other. */
  function changeFields(update: (prev: Record<string, unknown>) => Record<string, unknown>) {
    setFields(update);
    touched();
  }

  function touched() {
    setVersion((v) => v + 1);
    setShowMissing(false);
  }

  function applyPrefill() {
    if (!prefill?.ok) return;
    setUndo({ fields, dx, from: `${DATE.format(new Date(prefill.date))} note by ${prefill.author}` });
    changeFields((prev) => ({ ...prev, ...prefill.fields }));
    if (prefill.dx) change({ dx: prefill.dx });
  }

  async function continueToSign() {
    if (missing.length) {
      setShowMissing(true);
      document.getElementById(`field-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLeaving(true);
    if (unsaved && !(await save())) {
      setLeaving(false);
      return;
    }
    router.push(`/appointments/${appointmentId}/sign`);
  }

  async function saveNow() {
    if (await save()) toast.success("Draft saved. You can finish it later from Notes to do.");
  }

  const actions = (
    <>
      <Button variant="secondary" onClick={saveNow} disabled={saveState === "saving"}>
        <Save aria-hidden />
        Save draft
      </Button>
      <Button onClick={continueToSign} disabled={leaving}>
        {leaving ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
        Continue to sign
      </Button>
    </>
  );

  const groups = template.groups.length ? template.groups : [{ key: "", name: "" }];
  const groupStats = groups.map((g) => {
    const inGroup = counted.filter((f) => f.group === g.key);
    return { ...g, total: inGroup.length, done: inGroup.filter((f) => isFilled(f, fields[f.id], goalCount)).length };
  });

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 md:pb-0">
      <PageHeader
        back={{ href: "/appointments", label: "Appointments" }}
        overline={overline}
        title={patientName}
        actions={<div className="hidden flex-wrap gap-2 md:flex">{actions}</div>}
      />

      {notice}

      {kind === "progress" && !notice && prefill?.ok && !undo && (
        <Banner tone="fern" icon={<Copy className="size-5" aria-hidden />}>
          <span className="min-w-[12rem] flex-1">
            <span className="block font-semibold">Start from the last visit?</span>
            <span className="block text-small">
              Copy the {DATE.format(new Date(prefill.date))} {CARE_LABEL[care].toLowerCase()} note by {prefill.author}. You can
              edit everything after.
            </span>
          </span>
          <Button variant="secondary" onClick={applyPrefill} className="w-full sm:w-auto">
            <Copy aria-hidden />
            Prefill from last visit
          </Button>
        </Banner>
      )}
      {kind === "progress" && prefill && !prefill.ok && prefill.reason === "other-practice" && (
        <Banner tone="neutral" icon={<Lock className="size-5" aria-hidden />}>
          <span className="text-small">Notes from other practices can&apos;t be copied.</span>
        </Banner>
      )}
      {undo && (
        <Banner tone="fern" icon={<Check className="size-5" aria-hidden />}>
          <span className="min-w-[12rem] flex-1 text-small">
            Copied from the {undo.from}. Billing minutes and visit times weren&apos;t copied.
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              changeFields(() => undo.fields);
              change({ dx: undo.dx });
              setUndo(null);
            }}
          >
            <Undo2 aria-hidden />
            Undo
          </Button>
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
        {/* Section outline (desktop) */}
        <aside className="hidden md:sticky md:top-10 md:block">
          {template.groups.length > 0 && (
            <nav aria-label="Note sections" className="grid gap-1 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
              <p className="mb-2 text-overline font-semibold text-muted-foreground uppercase">{CARE_LABEL[care]}</p>
              {groupStats.map((g) => (
                <a
                  key={g.key}
                  href={`#group-${g.key}`}
                  className="flex items-center gap-3 rounded-sm px-2 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <GroupBadge g={g} />
                  <span className="min-w-0 flex-1 truncate text-small font-semibold">{g.name}</span>
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {g.done}/{g.total}
                  </span>
                </a>
              ))}
              <p className="mt-2 border-t border-border-subtle pt-3 text-small font-semibold text-primary">
                {done} of {counted.length} sections done
              </p>
            </nav>
          )}
        </aside>

        <div className="grid min-w-0 grid-cols-1 gap-6">
          {/* Type of note (discipline) or type of care (therapy) */}
          <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
            {isDiscipline(care) ? (
              <div className="grid gap-2">
                <p id="kind-label" className="text-sm font-medium">
                  Type of note
                </p>
                {kinds.length > 1 ? (
                  <div role="radiogroup" aria-labelledby="kind-label" className="flex flex-wrap gap-2">
                    {kinds.map((k) => (
                      <ChoiceChip key={k} single on={kind === k} onClick={() => change({ kind: k })}>
                        {k === "progress" ? "Progress note" : KIND_LABEL[k]}
                      </ChoiceChip>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold">{CARE_LABEL[care]}</p>
                )}
                <p className="text-small text-muted-foreground">
                  {CARE_LABEL[care]} · {template.typeLine}
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <p id="care-label" className="text-sm font-medium">
                  Type of care
                </p>
                <div role="radiogroup" aria-labelledby="care-label" className="flex flex-wrap gap-2">
                  {THERAPY_CARES.map((c) => (
                    <ChoiceChip key={c} single on={care === c} onClick={() => change({ care: c })}>
                      {CARE_LABEL[c]}
                    </ChoiceChip>
                  ))}
                </div>
                <p className="text-small text-muted-foreground">{template.typeLine}</p>
              </div>
            )}
            <DiagnosisPicker
              label="Diagnosis code"
              value={dx}
              onChange={(v) => change({ dx: v })}
              search={searchNoteDiagnoses}
            />
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="font-semibold">
                  {done} of {counted.length} sections done
                </span>
                <SaveStatus state={saveState} />
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-sunken"
                role="progressbar"
                aria-label="Sections done"
                aria-valuemin={0}
                aria-valuemax={counted.length}
                aria-valuenow={done}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${counted.length ? (done / counted.length) * 100 : 0}%` }}
                />
              </div>
              {saveState === "error" && saveError && <p className="text-small text-destructive">{saveError}</p>}
            </div>
          </section>

          {/* Jump chips (phone) */}
          {template.groups.length > 0 && (
            <nav aria-label="Jump to section" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:hidden">
              {groupStats.map((g) => (
                <a
                  key={g.key}
                  href={`#group-${g.key}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-input bg-card px-3 text-caption font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <GroupBadge g={g} small />
                  {g.name} {g.done}/{g.total}
                </a>
              ))}
            </nav>
          )}

          {visitTimes}

          {groupStats.map((g) => (
            <section
              key={g.key || "all"}
              id={`group-${g.key}`}
              aria-label={g.name || undefined}
              className="grid scroll-mt-24 gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6"
            >
              {g.name && (
                <div className="flex items-center gap-3">
                  <GroupBadge g={g} />
                  <h2 className="flex-1 text-h3">{g.name}</h2>
                  <span className="text-small text-muted-foreground">
                    {g.done} of {g.total}
                  </span>
                </div>
              )}
              {template.fields
                .filter((f) => f.group === g.key)
                .map((f) => {
                  const filled = isFilled(f, fields[f.id], goalCount);
                  const flagged = showMissing && missing.some((m) => m.id === f.id);
                  return (
                    <div
                      key={f.id}
                      id={`field-${f.id}`}
                      className={cn(
                        "grid scroll-mt-24 gap-3 border-t border-border-subtle pt-5 first:border-t-0 first:pt-0",
                        g.name && "first:border-t first:pt-5",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p id={`${f.id}-label`} className="font-semibold">
                          {f.label}
                          {f.type === "many" && <span className="font-normal text-muted-foreground"> · Pick any</span>}
                          {f.optional && <span className="font-normal text-muted-foreground"> · Optional</span>}
                        </p>
                        {filled ? (
                          <span className="flex shrink-0 items-center gap-1 text-small font-semibold text-success-foreground">
                            <Check className="size-4" aria-hidden />
                            Done
                          </span>
                        ) : flagged ? (
                          <span className="shrink-0 text-small font-semibold text-destructive">Needed to sign</span>
                        ) : null}
                      </div>
                      {f.hint && <p className="-mt-1 text-small text-muted-foreground">{f.hint}</p>}
                      <NoteField
                        field={f}
                        value={fields[f.id]}
                        onChange={(v) => changeFields((prev) => ({ ...prev, [f.id]: v }))}
                        evaluationGoals={evaluationGoals}
                      />
                    </div>
                  );
                })}
            </section>
          ))}

          {showMissing && missing.length > 0 && (
            <FormAlert>
              Fill {missing.length} more {missing.length === 1 ? "section" : "sections"} to sign:{" "}
              {missing.map((m) => m.label).join(", ")}.
            </FormAlert>
          )}

          <div className="hidden flex-wrap justify-end gap-2 md:flex">{actions}</div>
        </div>
      </div>

      {/* Phone: main buttons in a bar at the bottom of detail screens (spec v2 layout). */}
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex gap-2 bg-card/95 px-5 py-3 shadow-up backdrop-blur md:hidden [&>button]:flex-1">
        {actions}
      </div>
    </div>
  );
}

function GroupBadge({ g, small = false }: { g: { key: string; total: number; done: number }; small?: boolean }) {
  if (!g.key) return null;
  const complete = g.total > 0 && g.done === g.total;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "size-5 text-[11px]" : "size-7 text-caption",
        complete ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
      )}
    >
      {g.key}
    </span>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground" aria-live="polite">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-success-foreground" aria-live="polite">
        <Check className="size-4" aria-hidden />
        Draft saved
      </span>
    );
  }
  if (state === "error") return <span className="text-destructive" aria-live="polite">Not saved</span>;
  return <span className="text-muted-foreground">Saves as you type</span>;
}

function Banner({ tone, icon, children }: { tone: "fern" | "neutral"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg px-4 py-3.5 sm:px-5",
        tone === "fern" ? "bg-muted text-foreground" : "bg-sunken text-muted-foreground",
      )}
    >
      <span className="text-primary">{icon}</span>
      {children}
    </div>
  );
}

export function AideLock({ patientFirstName, planHref }: { patientFirstName: string; planHref: string | null }) {
  return (
    <div role="alert" className="grid gap-3 rounded-lg bg-warning p-5 text-warning-foreground sm:p-6">
      <p className="flex items-center gap-2 text-title font-semibold">
        <Lock className="size-5" aria-hidden />
        Service plan needed first
      </p>
      <p>
        {patientFirstName} has no signed aide service plan yet, so this visit can&apos;t be documented. A nurse writes the
        plan when skilled nursing is ordered; otherwise PT or OT on the case writes it.
      </p>
      {planHref ? (
        <Button className="w-fit" nativeButton={false} render={<Link href={planHref} />}>
          Finish service plan
        </Button>
      ) : (
        <p className="text-small">Ask the nurse or therapist on {patientFirstName}&apos;s care team to write it from one of their visits.</p>
      )}
    </div>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { ChoiceChip } from "@/components/choice-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { billableUnits, type Field, type Goal } from "@/lib/note-templates";
import { cn } from "@/lib/utils";

// Inputs for each note section type (spec v2 "Design system additions": choice chips,
// measures grid, level rows, goal set editor, billing codes table).

type Props = {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Goals from the latest signed evaluation, for "Goal progress". */
  evaluationGoals?: { goals: Goal[]; from: string } | null;
};

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function NoteField({ field, value, onChange, evaluationGoals }: Props) {
  switch (field.type) {
    case "text":
      return (
        <Textarea
          aria-labelledby={`${field.id}-label`}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-28"
        />
      );

    case "one":
      return (
        <div role="radiogroup" aria-labelledby={`${field.id}-label`} className="flex flex-wrap gap-2">
          {field.options.map((o) => (
            <ChoiceChip key={o} single on={value === o} onClick={() => onChange(value === o ? "" : o)}>
              {o}
            </ChoiceChip>
          ))}
        </div>
      );

    case "many": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div role="group" aria-labelledby={`${field.id}-label`} className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const on = list.includes(o);
            return (
              <ChoiceChip key={o} on={on} onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}>
                {o}
              </ChoiceChip>
            );
          })}
        </div>
      );
    }

    case "measures": {
      const rec = asRecord(value);
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {field.items.map((item) => (
            <label key={item.id} className="grid gap-1.5">
              <span className="text-small text-muted-foreground">{item.label}</span>
              <span className="relative">
                <Input
                  inputMode={item.text ? "text" : "decimal"}
                  value={typeof rec[item.id] === "string" ? (rec[item.id] as string) : ""}
                  onChange={(e) => onChange({ ...rec, [item.id]: e.target.value })}
                  className={cn(item.unit && "pr-14")}
                  placeholder={item.text ? "120/80" : "–"}
                />
                {item.unit && (
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-small text-muted-foreground">
                    {item.unit}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      );
    }

    case "levels": {
      const rec = asRecord(value);
      return (
        <div className="grid gap-4">
          {field.items.map((item) => (
            <div key={item} className="grid gap-2 border-b border-border-subtle pb-4 last:border-b-0 last:pb-0">
              <p id={`${field.id}-${item}`} className="text-small font-semibold">
                {item}
              </p>
              <div role="radiogroup" aria-labelledby={`${field.id}-${item}`} className="flex flex-wrap gap-1.5">
                {field.levels.map((lv) => (
                  <ChoiceChip
                    key={lv}
                    single
                    size="sm"
                    on={rec[item] === lv}
                    onClick={() => onChange({ ...rec, [item]: rec[item] === lv ? "" : lv })}
                  >
                    {lv}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "scores": {
      const rec = asRecord(value);
      return (
        <div className="grid gap-4">
          {field.items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-4 last:border-b-0 last:pb-0">
              <p id={`${field.id}-${item.id}`} className="text-small font-semibold">
                {item.label}
              </p>
              <div role="radiogroup" aria-labelledby={`${field.id}-${item.id}`} className="flex flex-wrap gap-1.5">
                {Array.from({ length: item.max + 1 }, (_, n) => (
                  <ChoiceChip
                    key={n}
                    single
                    size="sm"
                    on={rec[item.id] === n}
                    onClick={() => onChange({ ...rec, [item.id]: rec[item.id] === n ? undefined : n })}
                  >
                    {n}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "goals":
      return <GoalEditor value={Array.isArray(value) ? (value as Goal[]) : []} onChange={onChange} />;

    case "goalProgress": {
      if (!evaluationGoals || evaluationGoals.goals.length === 0) {
        return (
          <p className="rounded-md bg-sunken px-4 py-3 text-small text-muted-foreground">
            No signed evaluation yet, so there are no goals to rate. Goals come from this patient&apos;s initial
            evaluation once it&apos;s signed.
          </p>
        );
      }
      const rec = asRecord(value);
      return (
        <div className="grid gap-4">
          {evaluationGoals.goals.map((g) => (
            <div key={g.id} className="grid gap-2 border-b border-border-subtle pb-4 last:border-b-0 last:pb-0">
              <p id={`goal-${g.id}`} className="text-small font-semibold">
                {g.text}
              </p>
              <div role="radiogroup" aria-labelledby={`goal-${g.id}`} className="flex flex-wrap gap-1.5">
                {["Met", "Progressing", "Not yet"].map((lv) => (
                  <ChoiceChip
                    key={lv}
                    single
                    size="sm"
                    on={rec[g.id] === lv}
                    onClick={() => onChange({ ...rec, [g.id]: rec[g.id] === lv ? "" : lv })}
                  >
                    {lv}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          ))}
          <p className="text-caption text-muted-foreground">{evaluationGoals.from}</p>
        </div>
      );
    }

    case "billing":
      return <BillingCodes field={field} value={asRecord(value)} onChange={onChange} />;
  }
}

function GoalEditor({ value, onChange }: { value: Goal[]; onChange: (v: Goal[]) => void }) {
  const goals = value.length ? value : [];
  const update = (i: number, patch: Partial<Goal>) => onChange(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <div className="grid gap-4">
      {goals.map((g, i) => (
        <div key={g.id} className="grid gap-3 rounded-md border border-border-subtle p-4">
          <div className="flex items-start gap-2">
            <span className="mt-3 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-primary">
              {i + 1}
            </span>
            <Input
              aria-label={`Goal ${i + 1}`}
              value={g.text}
              placeholder="e.g. Walk 150 feet without a cane"
              onChange={(e) => update(i, { text: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove goal ${i + 1}`}
              onClick={() => onChange(goals.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-8">
            {(["short", "long"] as const).map((t) => (
              <ChoiceChip key={t} single size="sm" on={g.term === t} onClick={() => update(i, { term: t })}>
                {t === "short" ? "Short-term" : "Long-term"}
              </ChoiceChip>
            ))}
            <span className="mx-1 self-center text-border-strong" aria-hidden>
              |
            </span>
            {[2, 4, 8, 12].map((w) => (
              <ChoiceChip key={w} single size="sm" on={g.weeks === w} onClick={() => update(i, { weeks: w })}>
                {w} weeks
              </ChoiceChip>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...goals, { id: crypto.randomUUID(), text: "", term: "short", weeks: 4 }])}
      >
        <Plus aria-hidden />
        Add goal
      </Button>
      <p className="text-caption text-muted-foreground">Make each goal measurable: what, how much, by when.</p>
    </div>
  );
}

function BillingCodes({
  field,
  value,
  onChange,
}: {
  field: Extract<Field, { type: "billing" }>;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  if (field.mode === "once" || field.mode === "pickOne") {
    const added = field.codes.filter((c) => value[c.code] === true).length;
    return (
      <div className="grid gap-2">
        {field.codes.map((c) => {
          const on = value[c.code] === true;
          return (
            <div key={c.code} className="flex items-center gap-3 rounded-md border border-border-subtle px-4 py-3">
              <span className="w-16 shrink-0 font-semibold tabular-nums">{c.code}</span>
              <span className="min-w-0 flex-1 text-small">{c.label}</span>
              <ChoiceChip
                size="sm"
                on={on}
                onClick={() =>
                  onChange(field.mode === "pickOne" ? (on ? {} : { [c.code]: true }) : { ...value, [c.code]: !on })
                }
              >
                {on ? "Added" : "Add"}
              </ChoiceChip>
            </div>
          );
        })}
        <p className="text-small text-muted-foreground">
          {added} {added === 1 ? "code" : "codes"} added ·{" "}
          {field.mode === "pickOne"
            ? "Pick the evaluation code that matches the complexity above."
            : "These codes are billed once per visit."}
        </p>
      </div>
    );
  }

  const minutes = field.codes.reduce((sum, c) => sum + (Number(value[c.code]) || 0), 0);
  return (
    <div className="grid gap-2">
      {field.codes.map((c) => (
        <label key={c.code} className="flex items-center gap-3 rounded-md border border-border-subtle px-4 py-2">
          <span className="w-16 shrink-0 font-semibold tabular-nums">{c.code}</span>
          <span className="min-w-0 flex-1 text-small">{c.label}</span>
          <span className="relative w-28 shrink-0">
            <Input
              inputMode="numeric"
              aria-label={`${c.code} ${c.label} minutes`}
              value={value[c.code] ? String(value[c.code]) : ""}
              onChange={(e) => {
                const n = Math.max(0, Math.min(480, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0));
                onChange({ ...value, [c.code]: n || undefined });
              }}
              className="h-10 pr-12"
              placeholder="0"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-caption text-muted-foreground">
              min
            </span>
          </span>
        </label>
      ))}
      <p className="text-small">
        <span className="font-semibold">{minutes} timed minutes</span> · {billableUnits(minutes)} billable{" "}
        {billableUnits(minutes) === 1 ? "unit" : "units"}
      </p>
      <p className="text-caption text-muted-foreground">
        {field.mode === "units15"
          ? "Home health nursing is billed in 15-minute units."
          : "Units follow the 8-minute rule: 8–22 minutes is 1 unit, 23–37 is 2, and so on."}
      </p>
    </div>
  );
}

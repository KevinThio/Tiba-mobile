"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blanksIn, TOKENS, type AgreementClause } from "@/lib/agreement-template";
import { saveAgreementTemplate } from "../agreement-actions";

/** Edit, reorder, add and remove the agreement's sections, or go back to Tiba's default wording. */
export function AgreementTemplateEditor({ initial, defaults }: { initial: AgreementClause[]; defaults: AgreementClause[] }) {
  const router = useRouter();
  const [clauses, setClauses] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blanks = blanksIn(clauses);
  const edit = (i: number, patch: Partial<AgreementClause>) => {
    setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    if (error) setError(null);
  };
  const move = (i: number, by: -1 | 1) =>
    setClauses((cs) => {
      const next = [...cs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  async function save(value: AgreementClause[] | null) {
    setBusy(true);
    setError(null);
    const result = await saveAgreementTemplate({ clauses: value }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the wording. Check your connection and try again.");
    if (value === null) setClauses(defaults);
    toast.success(value === null ? "Back to Tiba's default wording." : "Wording saved. New agreements use it.");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-2 rounded-lg border border-border-subtle bg-muted p-5">
        <h2 className="text-h3">How it works</h2>
        <p className="text-small">
          Words in <code>{"{braces}"}</code> are filled in from each agreement. Words in <code>[brackets]</code> are blanks only you
          can fill in, like your state complaint hotline or administrator&apos;s phone. Replace them with your details.
        </p>
        <ul className="grid gap-0.5 text-small text-muted-foreground">
          {TOKENS.map((t) => (
            <li key={t.token}>
              <code className="text-foreground">{t.token}</code> {t.means}
            </li>
          ))}
        </ul>
      </section>

      {blanks.length > 0 && (
        <p className="flex gap-2 rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Still to fill in: {blanks.join(", ")}.
        </p>
      )}

      {clauses.map((c, i) => (
        <fieldset key={c.id} className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
          <legend className="sr-only">Section {i + 1}</legend>
          <div className="grid gap-2">
            <Label htmlFor={`h-${c.id}`}>Section {i + 1} heading</Label>
            <Input id={`h-${c.id}`} value={c.h} maxLength={120} onChange={(e) => edit(i, { h: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`t-${c.id}`}>Wording</Label>
            <Textarea id={`t-${c.id}`} rows={5} maxLength={4000} value={c.text} onChange={(e) => edit(i, { text: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move section ${i + 1} up`}>
              <ArrowUp aria-hidden /> Up
            </Button>
            <Button variant="ghost" size="sm" disabled={i === clauses.length - 1} onClick={() => move(i, 1)} aria-label={`Move section ${i + 1} down`}>
              <ArrowDown aria-hidden /> Down
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={clauses.length === 1}
              onClick={() => {
                if (window.confirm(`Remove "${c.h}"?`)) setClauses((cs) => cs.filter((_, j) => j !== i));
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </fieldset>
      ))}

      <Button variant="outline" className="w-fit" onClick={() => setClauses((cs) => [...cs, { id: crypto.randomUUID(), h: "New section", text: "" }])}>
        <Plus aria-hidden /> Add a section
      </Button>

      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(clauses)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save wording
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Go back to Tiba's default wording? Your changes will be lost.")) save(null);
          }}
        >
          <RotateCcw aria-hidden /> Use the default wording
        </Button>
      </div>
    </div>
  );
}

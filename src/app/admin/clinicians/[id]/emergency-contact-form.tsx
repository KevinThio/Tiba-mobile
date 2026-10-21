"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { saveEmergencyContact } from "../actions";

/** Emergency contact: name, relationship (optional) and phone. */
export function EmergencyContactForm({ clinicianId, initial }: { clinicianId: string; initial: { name: string; relationship: string; phone: string } }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = JSON.stringify(c) !== JSON.stringify(saved);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await saveEmergencyContact({ clinicianId, ...c }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save that. Check your connection and try again.");
    setSaved(c);
    toast.success("Emergency contact saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Name" name="emergencyName" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        <FormField label="Relationship (optional)" name="emergencyRelationship" value={c.relationship} onChange={(e) => setC({ ...c, relationship: e.target.value })} />
        <FormField label="Phone" name="emergencyPhone" type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {changed && (
        <Button type="submit" className="w-fit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save contact
        </Button>
      )}
    </form>
  );
}

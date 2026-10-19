"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { LogoUpload } from "@/components/logo-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updatePractice } from "@/lib/practice-actions";

/** Change the practice name and logo shown on visit notes. */
export function PracticeDetailsDialog({
  practiceName,
  logoUrl,
  triggerClassName,
}: {
  practiceName: string;
  logoUrl: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" className={triggerClassName} />}>
        <Building2 className="size-4" aria-hidden />
        Practice details
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-primary">Practice details</DialogTitle>
          <DialogDescription>Your practice name and logo appear at the top of your visit notes.</DialogDescription>
        </DialogHeader>
        {open && <PracticeForm practiceName={practiceName} logoUrl={logoUrl} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PracticeForm({ practiceName, logoUrl, onDone }: { practiceName: string; logoUrl: string | null; onDone: () => void }) {
  const router = useRouter();
  // undefined = logo unchanged.
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await updatePractice({ practiceName: String(form.get("practiceName")), logo });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Saved. Your notes will use these details.");
      onDone();
      router.refresh();
    } catch {
      setError("We couldn't save just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <FormField label="Practice name" name="practiceName" defaultValue={practiceName} autoComplete="organization" required />
      <LogoUpload value={logo} previewUrl={logoUrl} onChange={setLogo} />
      {error && <FormAlert>{error}</FormAlert>}
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

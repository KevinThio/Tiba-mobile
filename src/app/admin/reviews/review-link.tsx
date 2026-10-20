"use client";

import { Copy } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const noop = () => () => {};

/**
 * The practice's own review link: it opens the review form with the practice already
 * picked, so patients don't need to type the name. Share it in emails, texts or a QR code.
 */
export function ReviewLink({ practiceId }: { practiceId: string }) {
  // The server doesn't know which address Tiba is reached at, so the browser fills it in.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}/review?practice=${practiceId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Review link copied.");
    } catch {
      toast.error("We couldn't copy it. Select the link and copy it instead.");
    }
  }

  return (
    <section aria-labelledby="review-link-heading" className="grid gap-3 rounded-lg bg-muted p-6">
      <div>
        <h2 id="review-link-heading" className="text-h3">
          Your review link
        </h2>
        <p className="text-small text-muted-foreground">
          Share it with patients after a visit. It opens the review form with your practice already picked.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border-subtle bg-card px-3.5 py-3 text-small">
          {origin ? url : " "}
        </code>
        <Button variant="outline" onClick={copy} disabled={!origin}>
          <Copy aria-hidden />
          Copy link
        </Button>
      </div>
    </section>
  );
}

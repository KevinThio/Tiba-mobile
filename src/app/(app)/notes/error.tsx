"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/** Error state (spec v2): "We couldn't load …" with Try again, which re-fetches the page. */
export default function NotesError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="To do" title="Notes to do" />
      <div
        role="alert"
        className="grid justify-items-center gap-3 rounded-lg border border-border-subtle bg-card px-6 py-10 text-center shadow-sm"
      >
        <TriangleAlert className="size-7 text-destructive" aria-hidden />
        <p className="font-semibold">We couldn&apos;t load your notes</p>
        <p className="text-small text-muted-foreground">Check your connection and try again. Nothing you&apos;ve written is lost.</p>
        <Button variant="outline" onClick={() => retry()}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      </div>
    </div>
  );
}

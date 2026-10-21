"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens a PDF route in a new tab, passing the viewer's time zone so times match the screen. */
export function DownloadPdfButton({ href, label = "Download PDF" }: { href: string; label?: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        window.open(`${href}?tz=${encodeURIComponent(tz)}`, "_blank", "noopener");
      }}
    >
      <Download aria-hidden /> {label}
    </Button>
  );
}

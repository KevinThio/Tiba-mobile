"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LOGO_MAX_DATA_URL_LENGTH, LOGO_MAX_PX } from "@/lib/practice-logo";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Practice logo picker (optional for clinicians, required for admins). Resizes the image in the browser and hands back a
 * PNG data URL (JPEG if the PNG would be too big), or null when removed.
 * `previewUrl` shows an already-saved logo.
 */
export function LogoUpload({
  value,
  previewUrl,
  onChange,
  required = false,
  hint = "Shown with your practice name at the top of your visit notes.",
  missing,
}: {
  value: string | null | undefined;
  previewUrl?: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Admins must add a logo; drops "(optional)" from the label. */
  required?: boolean;
  hint?: string;
  /** Message shown when the form was sent without a required logo. */
  missing?: string | null;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // undefined = untouched, so fall back to the saved logo.
  const shown = value === undefined ? previewUrl : value;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Please choose a PNG or JPG.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That image is over 5 MB. Please choose a smaller one.");
      return;
    }
    setBusy(true);
    try {
      onChange(await resizeToDataUrl(file));
    } catch {
      setError("We couldn't read that image. Please try a PNG or JPG.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {required ? "Practice logo" : "Practice logo (optional)"}
      </label>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-card">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL or private route, not optimisable
            <img src={shown} alt="Your practice logo" className="max-h-full max-w-full object-contain p-1.5" />
          ) : (
            <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Preparing…" : shown ? "Change logo" : "Add a logo"}
          </Button>
          {shown && (
            <Button type="button" variant="ghost" onClick={() => onChange(null)} aria-label="Remove logo">
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        aria-describedby={hintId}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {error || missing ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? missing}
        </p>
      ) : (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

async function resizeToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // SVGs without a set size report 0; draw those at the maximum size.
    const w = img.naturalWidth || LOGO_MAX_PX;
    const h = img.naturalHeight || LOGO_MAX_PX;
    const scale = Math.min(1, LOGO_MAX_PX / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    if (png.length <= LOGO_MAX_DATA_URL_LENGTH) return png;
    // Photos make big PNGs: fall back to JPEG on white.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.88);
    if (jpeg.length <= LOGO_MAX_DATA_URL_LENGTH) return jpeg;
    throw new Error("Too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

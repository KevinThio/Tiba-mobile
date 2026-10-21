"use client";

import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Signature pad (spec v2 design system): the signer's name above, "Sign here with your finger or
 * mouse", and Clear. Reports a PNG data URL after each stroke, or null once cleared.
 */
export function SignaturePad({
  name,
  label,
  initial = null,
  onChange,
  invalid = false,
  className,
}: {
  /** Who signs, shown above the pad. */
  name: string;
  /** e.g. "Your signature" or "Patient signature". */
  label: string;
  /** A signature to start with (a PNG data URL), e.g. one drawn on another pad. */
  initial?: string | null;
  /** Shows the pad's border in the danger colour (pair it with an error message). */
  invalid?: boolean;
  onChange: (dataUrl: string | null) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onChangeRef = useRef(onChange);
  const initialRef = useRef(initial);
  const [empty, setEmpty] = useState(!initial);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || "black";
    const pad = new SignaturePadLib(canvas, { penColor: ink, minWidth: 0.8, maxWidth: 2.6 });
    padRef.current = pad;

    // Match the canvas to its on-screen size and the screen's pixel density, keeping the signature
    // (as strokes when drawn here, or as the image it started from).
    const fit = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || (canvas.width === Math.round(width * ratio) && canvas.height === Math.round(height * ratio))) return;
      const strokes = pad.toData();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      if (initialRef.current) void pad.fromDataURL(initialRef.current, { ratio, width, height });
      else if (strokes.length) pad.fromData(strokes);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);

    const end = () => {
      const blank = pad.isEmpty();
      const url = blank ? null : pad.toDataURL("image/png");
      // A pad that started from an image keeps redrawing from the latest picture.
      if (initialRef.current) initialRef.current = url;
      setEmpty(blank);
      onChangeRef.current(url);
    };
    pad.addEventListener("endStroke", end);
    return () => {
      observer.disconnect();
      pad.removeEventListener("endStroke", end);
      pad.off();
      padRef.current = null;
    };
  }, []);

  const clear = () => {
    padRef.current?.clear();
    initialRef.current = null;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-overline font-semibold text-muted-foreground uppercase">{label}</p>
          <p className="truncate font-semibold">{name}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty} className="shrink-0">
          <Eraser aria-hidden /> Clear
        </Button>
      </div>
      <div className={cn("relative rounded-md border-[1.5px] border-dashed bg-card", invalid ? "border-destructive" : "border-border-strong")}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${label}: ${empty ? "not signed yet" : "signed"}`}
          className="block h-44 w-full touch-none rounded-md"
        />
        <span aria-hidden className="pointer-events-none absolute right-5 bottom-10 left-5 border-b border-border" />
        {empty && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-caption text-subtle-foreground">
            Sign here with your finger or mouse
          </span>
        )}
      </div>
    </div>
  );
}

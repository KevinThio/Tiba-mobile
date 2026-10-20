import { cn } from "@/lib/utils";

/** First letters of the first two words, e.g. "Reyes Therapy" → "RT". */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** The practice logo in a small frame, or the name's initials when there is no logo. */
export function PracticeMark({
  practiceName,
  logoUrl,
  className,
}: {
  practiceName: string;
  logoUrl: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-accent",
        logoUrl && "bg-card",
        className,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- private route, not optimisable
        <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain p-1" />
      ) : (
        <span className="text-sm font-semibold text-accent-foreground" aria-hidden>
          {initialsOf(practiceName)}
        </span>
      )}
    </span>
  );
}

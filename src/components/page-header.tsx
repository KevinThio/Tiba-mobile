import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Top of every screen: optional back link and overline, the serif title, one short line of help,
 * and the main action(s). Matches the prototype header, e.g. back "Notes", overline
 * "Visit note · 16 Oct 2026 · 09:00–09:50", title "Amina Hassan".
 */
export function PageHeader({
  title,
  overline,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  overline?: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-2 rounded-sm text-small font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 gap-1">
          {overline && <p className="text-overline font-semibold text-muted-foreground uppercase">{overline}</p>}
          <h1 className="text-3xl leading-tight md:text-4xl">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

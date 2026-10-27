import { ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * The frame around the sign-in screens (staff and patient portal).
 * Desktop: brand panel on the left, form on the right.
 * Phone: just the logo and the form, so the keyboard has room.
 */
export function AuthFrame({
  home,
  headline,
  highlights,
  panelNote,
  footer,
  children,
}: {
  home: string;
  headline: string;
  highlights: { icon: LucideIcon; text: string }[];
  panelNote: string;
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="relative hidden w-[44%] max-w-xl shrink-0 overflow-hidden bg-secondary lg:block">
        <div className="sticky top-0 flex h-dvh flex-col justify-between p-12">
          {/* Morning sun: soft lilac glow and the smile from the logo mark. */}
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-lilac/50 blur-3xl" />
          <svg
            aria-hidden
            viewBox="0 0 96 96"
            className="pointer-events-none absolute -right-16 -bottom-20 size-[26rem] text-primary/[0.06]"
          >
            <path d="M27 44C33 60 40 67 48 67S63 60 69 44" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          </svg>

          <Link href={home} aria-label="Tiba" className="relative w-fit">
            <Logo />
          </Link>

          <div className="relative grid gap-8">
            <h2 className="max-w-sm text-4xl leading-tight xl:text-5xl">{headline}</h2>
            <ul className="grid gap-4">
              {highlights.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-lg">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-xs">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            {panelNote}
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col px-5 py-10 sm:px-8">
        <Link href={home} aria-label="Tiba" className="mx-auto lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center py-10">{children}</div>
        <p className="mx-auto flex max-w-form items-center gap-2 text-caption text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          {footer}
        </p>
      </main>
    </div>
  );
}

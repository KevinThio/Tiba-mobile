import { PracticeMark } from "@/components/practice-mark";
import type { Letterhead } from "@/db/schema";
import type { ContractSection } from "@/lib/contracts";

type Signer = { label: string; name: string; image: string | null; at: string | null } | null;

const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * A contract on the practice letterhead (spec v2 section 5c): the uploaded letterhead image, or
 * the logo (initials when there's none) with address, phone and email; the numbered clauses; and
 * signature tiles. Used for the live preview, both apps' contract screens and (mirrored) the PDF.
 */
export function ContractDocument({
  practiceName,
  logoUrl,
  letterhead,
  label,
  type,
  clinicianName,
  sections,
  admin,
  clinician,
}: {
  practiceName: string;
  logoUrl: string | null;
  letterhead: Letterhead;
  label: string;
  type: string;
  clinicianName: string;
  sections: ContractSection[];
  admin: Signer;
  clinician: Signer;
}) {
  const contact = [letterhead.address, letterhead.phone, letterhead.email].filter((x) => x.trim());
  return (
    <article className="grid w-full gap-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-8">
      <header className="border-b border-border-subtle pb-5">
        {letterhead.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not optimisable
          <img src={letterhead.image} alt={`${practiceName} letterhead`} className="max-h-32 w-full object-contain object-left" />
        ) : (
          <div className="flex items-center gap-4">
            <PracticeMark practiceName={practiceName} logoUrl={logoUrl} />
            <div className="min-w-0">
              <p className="font-heading text-xl leading-tight text-primary">{practiceName}</p>
              {contact.length > 0 && <p className="text-small break-words text-muted-foreground">{contact.join(" · ")}</p>}
            </div>
          </div>
        )}
      </header>
      <div className="grid gap-1">
        <p className="text-overline font-semibold text-muted-foreground uppercase">{label}</p>
        <h2 className="text-h2">{type}</h2>
        <p className="text-small text-muted-foreground">
          Between {practiceName} and {clinicianName || "the clinician"}
        </p>
      </div>
      <div className="grid gap-4">
        {sections.map((s) => (
          <div key={s.h} className="grid gap-1">
            <h3 className="font-sans text-body font-semibold text-primary">{s.h}</h3>
            <p className="break-words whitespace-pre-line">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[admin, clinician].map((s, i) =>
          s ? (
            <figure key={i} className="grid gap-2 rounded-md border border-border-subtle p-4">
              <figcaption className="text-overline font-semibold text-muted-foreground uppercase">{s.label}</figcaption>
              <div className="flex h-20 items-center justify-center border-b border-border">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not optimisable
                  <img src={s.image} alt={`${s.name}'s signature`} className="max-h-full w-auto max-w-full object-contain" />
                ) : (
                  <span className="text-small text-subtle-foreground">Waiting for signature</span>
                )}
              </div>
              <p className="flex flex-wrap justify-between gap-x-3 text-small">
                <span className="font-semibold">{s.name}</span>
                {s.at && <span className="text-muted-foreground">{STAMP.format(new Date(s.at))}</span>}
              </p>
            </figure>
          ) : null,
        )}
      </div>
    </article>
  );
}

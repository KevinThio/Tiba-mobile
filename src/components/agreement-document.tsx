import { PracticeMark } from "@/components/practice-mark";
import type { AgreementClause, AgreementDetails } from "@/lib/agreement-template";

type Signer = { label: string; name: string; image: string | null; at: string | null; note?: string } | null;

const DAY = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const v = (s: string) => s.trim() || "—";
const place = (a: { address: string; city: string; state: string; zip: string }) => [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter((x) => x.trim()).join(", ") || "—";

/**
 * A service agreement as the client reads it: the letterhead, the client, emergency contact,
 * insurance and services, the practice's clauses, the client's answers and the signatures.
 * Mirrored by the PDF (src/lib/paperwork-pdf.tsx).
 */
export function AgreementDocument({
  practiceName,
  logoUrl,
  contact,
  patient,
  details: d,
  sections,
  client,
  witness,
}: {
  practiceName: string;
  logoUrl: string | null;
  contact: string;
  patient: { name: string; dob: string; referralDate: string | null };
  details: AgreementDetails;
  sections: AgreementClause[];
  client: Signer;
  witness: Signer;
}) {
  const included = d.services.filter((s) => s.included);
  return (
    <article className="grid w-full gap-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-8">
      <header className="flex items-center gap-4 border-b border-border-subtle pb-5">
        <PracticeMark practiceName={practiceName} logoUrl={logoUrl} />
        <div className="min-w-0">
          <p className="font-heading text-xl leading-tight text-primary">{practiceName}</p>
          {contact && <p className="text-small break-words text-muted-foreground">{contact}</p>}
        </div>
      </header>
      <h2 className="text-h2">Service agreement</h2>

      <Block title="Client">
        <Grid
          rows={[
            ["Client name", patient.name],
            ["Date of birth", DAY(patient.dob)],
            ["Date of referral", patient.referralDate ? DAY(patient.referralDate) : "—"],
            ["Date of initial contact", d.client.initialContactDate ? DAY(d.client.initialContactDate) : "—"],
            ["Address", place(d.client)],
            ["Telephone", v(d.client.phone)],
          ]}
        />
      </Block>
      <Block title="Emergency contact">
        <Grid
          rows={[
            ["Name", d.emergency.name ? `${d.emergency.name}${d.emergency.relationship ? ` (${d.emergency.relationship})` : ""}` : "—"],
            ["Telephone", v(d.emergency.phone)],
            ["Address", place(d.emergency)],
          ]}
        />
      </Block>
      <Block title="Insurance details">
        <Grid
          rows={[
            ["Responsible party", v(d.insurance.responsibleParty)],
            ["Telephone", v(d.insurance.phone)],
            ["Address", place(d.insurance)],
          ]}
        />
      </Block>
      <Block title="Services">
        {d.serviceNeeds.trim() && (
          <p className="text-small">
            <span className="font-semibold">I believe my service needs to be: </span>
            <span className="whitespace-pre-line">{d.serviceNeeds}</span>
          </p>
        )}
        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full min-w-[40rem] text-left text-small">
            <thead className="bg-muted text-caption font-semibold text-muted-foreground">
              <tr>
                {["Service", "Frequency", "Duration", "Charge", "Payer", "Payer pays", "Client pays"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(included.length ? included : d.services).map((s) => (
                <tr key={s.key} className="border-t border-border-subtle">
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {s.label}
                  </th>
                  {[s.frequency, s.duration, s.charge, s.payer, s.payerAmount, s.clientAmount].map((x, i) => (
                    <td key={i} className="px-3 py-2 break-words">
                      {s.included ? v(x) : "N/A"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
      <Block title="Bill rate">
        {d.rates.notApplicable ? (
          <p className="text-small">Not applicable.</p>
        ) : (
          <Grid
            rows={[
              ["Weekend", `${v(d.rates.weekend.amount)} for ${v(d.rates.weekend.hours)} hours / ${v(d.rates.weekend.visits)} visits`],
              ["Weekdays", `${v(d.rates.weekday.amount)} for ${v(d.rates.weekday.hours)} hours / ${v(d.rates.weekday.visits)} visits`],
            ]}
          />
        )}
      </Block>

      <div className="grid gap-4">
        {sections.map((s) => (
          <div key={s.id} className="grid gap-1">
            <h3 className="font-sans text-body font-semibold text-primary">{s.h}</h3>
            <p className="break-words whitespace-pre-line">{s.text}</p>
          </div>
        ))}
      </div>

      <Block title="The client's answers">
        <Grid
          rows={[
            ["Access to personal funds", d.authorizations.personalFunds === null ? "—" : d.authorizations.personalFunds ? "Yes" : "No"],
            ["Use of personal vehicle", d.authorizations.vehicle === null ? "—" : d.authorizations.vehicle ? "Yes" : "No"],
            [
              "Services",
              d.signer.kind === "refused" ? "Refused to sign" : d.decision === "accept" ? "Accepted" : d.decision === "deny" ? "Denied" : "—",
            ],
            ["Initials", v(d.initials)],
          ]}
        />
      </Block>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[client, witness].map((s, i) =>
          s ? (
            <figure key={i} className="grid gap-2 rounded-md border border-border-subtle p-4">
              <figcaption className="text-overline font-semibold text-muted-foreground uppercase">{s.label}</figcaption>
              <div className="flex h-20 items-center justify-center border-b border-border">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not optimisable
                  <img src={s.image} alt={`${s.name}'s signature`} className="max-h-full w-auto max-w-full object-contain" />
                ) : (
                  <span className="text-small text-subtle-foreground">{s.note ?? "Waiting for signature"}</span>
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-overline font-sans font-semibold text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(([k, val]) => (
        <div key={k} className="min-w-0">
          <dt className="text-caption text-muted-foreground">{k}</dt>
          <dd className="break-words">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

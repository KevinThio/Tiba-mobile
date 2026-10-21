// Contracts (spec v2 section 5c and the prototype). The clauses are written from the terms, so
// the preview, the signed view and the PDF always say the same thing. Shared by server and browser.

import type { ContractTerms } from "@/db/schema";

export const CONTRACT_TYPES = ["Independent contractor agreement", "Employment offer", "Confidentiality agreement"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_LENGTHS = ["3 months", "6 months", "12 months", "No end date"] as const;

export type ContractStatus = "draft" | "sent" | "feedback" | "signed";

export const STATUS_BADGE: Record<ContractStatus, { label: string; variant: "neutral" | "warning" | "info" | "success" }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Waiting to sign", variant: "warning" },
  feedback: { label: "Message", variant: "info" },
  signed: { label: "Signed", variant: "success" },
};

/** "2027-01-01" → "1 Jan 2027" */
export function contractDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "a date you agree";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export type ContractSection = { h: string; text: string };

/** The numbered clauses for a contract (prototype wording), plus "Other terms" when given. */
export function contractSections(type: string, t: ContractTerms, clinicianName: string, practiceName: string): ContractSection[] {
  const who = clinicianName || "the clinician";
  const pr = practiceName || "the practice";
  const role = t.role.trim() || "clinical";
  const extra = t.extra.trim() ? [{ h: "Other terms", text: t.extra.trim() }] : [];
  if (type === "Employment offer") {
    return [
      { h: "1. Position", text: `${pr} offers ${who} the role of ${role}, starting ${contractDate(t.start)}.` },
      { h: "2. Pay", text: `You will be paid ${t.pay.trim() || "as agreed"}, every two weeks, with taxes withheld as required by law.` },
      {
        h: "3. Length",
        text: t.length === "No end date" ? "This is an ongoing role." : `This offer covers ${t.length} from the start date and can be renewed.`,
      },
      {
        h: "4. Duties",
        text: "Provide care as set out in each patient's service plan, document every visit in Tiba on the same day, and report changes to the nurse or therapist right away.",
      },
      { h: "5. Certifications", text: "Keep your certifications current and upload renewals to your Tiba profile." },
      { h: "6. Confidentiality", text: "Keep patient information private, in line with the law and practice policy." },
      ...extra,
    ];
  }
  if (type === "Confidentiality agreement") {
    return [
      { h: "1. Purpose", text: `${who} will see patient and practice information while working with ${pr}. This agreement protects it.` },
      { h: "2. What you agree to", text: "Use patient information only to provide care, never share passwords, and lock your device when you step away." },
      { h: "3. Privacy law", text: "Follow the privacy and security rules that apply to health information. Report any suspected breach to the practice admin within 24 hours." },
      { h: "4. After you leave", text: `These duties continue after your work with ${pr} ends.` },
      ...extra,
    ];
  }
  return [
    { h: "1. Services", text: `${who} will provide ${role} services to patients of ${pr} as an independent contractor, starting ${contractDate(t.start)}.` },
    { h: "2. Pay", text: `${t.pay.trim() || "Rates as agreed"}. Invoices are sent through Tiba after each signed visit and paid within 30 days.` },
    {
      h: "3. Length and ending",
      text: `${t.length === "No end date" ? "This agreement has no end date." : `This agreement runs for ${t.length}.`} Either side can end it with 30 days' written notice.`,
    },
    { h: "4. Notes", text: "Sign every visit note in Tiba within 24 hours of the visit." },
    { h: "5. Licence and insurance", text: "Keep your licence and malpractice insurance current, and upload renewals to your Tiba profile." },
    { h: "6. Taxes", text: "As a contractor you are responsible for your own taxes. Upload any tax forms your practice needs to your Tiba profile." },
    { h: "7. Confidentiality", text: "Keep patient information private, in line with the law and practice policy." },
    ...extra,
  ];
}

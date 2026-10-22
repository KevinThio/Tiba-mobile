// Service agreement (spec v2 section 5), modelled on a US home care agency's service agreement
// form. The clauses are the practice's wording (editable in admin Settings); {tokens} are filled
// from the agreement's details, and [brackets] are blanks the practice fills in once in Settings.
// Shared by the server and the browser.

export type AgreementClause = { id: string; h: string; text: string };

/** The services an agreement can list, in order, with the patient's "services ordered" code that pre-ticks each. */
export const SERVICE_ROWS = [
  { key: "nursing", label: "RN/LPN visits", ordered: "RN" },
  { key: "pt", label: "Physical therapy (PT) visits", ordered: "PT" },
  { key: "ot", label: "Occupational therapy (OT) visits", ordered: "OT" },
  { key: "st", label: "Speech therapy (ST) visits", ordered: "ST" },
  { key: "personal", label: "Personal Care Assistant visits", ordered: "HHA" },
  { key: "companion", label: "Companion/sitter visits", ordered: null },
] as const;
export type ServiceKey = (typeof SERVICE_ROWS)[number]["key"];
export const SERVICE_KEYS = SERVICE_ROWS.map((r) => r.key) as [ServiceKey, ...ServiceKey[]];

export type ServiceRow = {
  key: ServiceKey;
  label: string;
  included: boolean;
  frequency: string;
  duration: string;
  charge: string;
  payer: string;
  payerAmount: string;
  clientAmount: string;
};

type Address = { address: string; city: string; state: string; zip: string; phone: string };

export type AgreementDetails = {
  client: Address & { initialContactDate: string };
  emergency: Address & { name: string; relationship: string };
  insurance: Address & { responsibleParty: string; coveragePercent: string; clientPerVisit: string; deductible: string };
  serviceNeeds: string;
  services: ServiceRow[];
  rates: { notApplicable: boolean; weekend: { amount: string; hours: string; visits: string }; weekday: { amount: string; hours: string; visits: string } };
  holidays: string;
  // Never a card number: only the amount, how it's paid and a check number if there is one.
  deposit: { amount: string; method: "none" | "check" | "cash" | "card"; checkNumber: string };
  authorizations: { personalFunds: boolean | null; vehicle: boolean | null };
  decision: "accept" | "deny" | null;
  initials: string;
  signer: { kind: "client" | "responsible" | "refused"; name: string; relationship: string };
  witnessName: string;
};

export type AgreementStatus = "none" | "draft" | "patient" | "admin" | "signed" | "refused";

export const AGREEMENT_BADGE: Record<AgreementStatus, { label: string; variant: "neutral" | "warning" | "success" }> = {
  none: { label: "No agreement", variant: "neutral" },
  draft: { label: "Details saved", variant: "neutral" },
  patient: { label: "Needs your signature", variant: "warning" },
  admin: { label: "Waiting for the client", variant: "warning" },
  signed: { label: "Agreement signed", variant: "success" },
  refused: { label: "Client refused to sign", variant: "warning" },
};

const emptyAddress = (): Address => ({ address: "", city: "", state: "", zip: "", phone: "" });

/** A new agreement, pre-filled from what Tiba already knows about the patient. */
function serviceRow(key: ServiceKey, label: string, included: boolean, insurer: string | null): ServiceRow {
  return { key, label, included, frequency: "", duration: "", charge: "", payer: included ? (insurer ?? "") : "", payerAmount: "", clientAmount: "" };
}

/**
 * An agreement's service rows in today's order, adding any it was saved without (PT, OT and ST
 * came after the first agreements), unticked. Only for agreements nobody has signed yet.
 */
export function withAllServices(details: AgreementDetails): AgreementDetails {
  const saved = new Map(details.services.map((s) => [s.key, s]));
  return { ...details, services: SERVICE_ROWS.map((r) => saved.get(r.key) ?? serviceRow(r.key, r.label, false, null)) };
}

export function newDetails(prefill: { address: string | null; phone: string | null; insurer: string | null; services: string[]; witnessName: string }): AgreementDetails {
  return {
    client: { ...emptyAddress(), address: prefill.address ?? "", phone: prefill.phone ?? "", initialContactDate: "" },
    emergency: { ...emptyAddress(), name: "", relationship: "" },
    insurance: { ...emptyAddress(), responsibleParty: prefill.insurer ?? "", coveragePercent: "", clientPerVisit: "", deductible: "" },
    serviceNeeds: "",
    // Ticked when the patient's record has that service ordered.
    services: SERVICE_ROWS.map((r) => {
      const included = r.ordered !== null && prefill.services.includes(r.ordered);
      return serviceRow(r.key, r.label, included, prefill.insurer);
    }),
    rates: { notApplicable: false, weekend: { amount: "", hours: "", visits: "" }, weekday: { amount: "", hours: "", visits: "" } },
    holidays: "",
    deposit: { amount: "", method: "none", checkNumber: "" },
    authorizations: { personalFunds: null, vehicle: null },
    decision: null,
    initials: "",
    signer: { kind: "client", name: "", relationship: "" },
    witnessName: prefill.witnessName,
  };
}

/** Tokens a clause can use, with what they become. */
export const TOKENS: { token: string; means: string }[] = [
  { token: "{practice}", means: "Your practice name" },
  { token: "{client}", means: "The client's name" },
  { token: "{insurer}", means: "Insurance company or responsible party" },
  { token: "{coveragePercent}", means: "Percent of charges the insurance covers" },
  { token: "{clientPerVisit}", means: "What the client pays per visit after insurance" },
  { token: "{deductible}", means: "Deductible billed to the client" },
  { token: "{holidays}", means: "Other local holidays" },
  { token: "{deposit}", means: 'The deposit sentence, e.g. "I agree to pay $50 by cash as a deposit…" or "No deposit is required."' },
];

const show = (v: string, fallback = "______") => (v.trim() ? v.trim() : fallback);

/** The clauses with their {tokens} filled in from the practice, the client and the details. */
export function renderClauses(clauses: AgreementClause[], ctx: { practice: string; client: string; details: AgreementDetails }) {
  const d = ctx.details;
  const deposit =
    d.deposit.method === "none" || !d.deposit.amount.trim()
      ? "No deposit is required."
      : `I agree to pay ${d.deposit.amount.trim()} by ${d.deposit.method}${d.deposit.method === "check" && d.deposit.checkNumber.trim() ? ` (check number ${d.deposit.checkNumber.trim()})` : ""} as a deposit when this agreement is signed.`;
  const values: Record<string, string> = {
    practice: ctx.practice,
    client: ctx.client,
    insurer: show(d.insurance.responsibleParty),
    coveragePercent: show(d.insurance.coveragePercent),
    clientPerVisit: show(d.insurance.clientPerVisit),
    deductible: show(d.insurance.deductible),
    holidays: show(d.holidays, "none"),
    deposit,
  };
  return clauses.map((c) => ({ ...c, text: c.text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m) }));
}

/** "[...]" blanks the practice hasn't filled in yet. */
export const blanksIn = (clauses: AgreementClause[]) => [...new Set(clauses.flatMap((c) => c.text.match(/\[[^\]]+\]/g) ?? []))];

let n = 0;
const c = (h: string, text: string): AgreementClause => ({ id: `default-${++n}`, h, text });

/** The default wording, from a home care agency's service agreement. Practices edit it in Settings. */
export const DEFAULT_CLAUSES: AgreementClause[] = [
  c(
    "Consent to services",
    'I grant permission to the employees of {practice}, here called "the Agency", to provide skilled nursing services, physical, occupational or speech therapy, personal care assistance, companion or sitter services, or other home care services as required and ordered by my physician.',
  ),
  c(
    "Client's rights, emergency plan and complaints",
    "I have been told about my rights and received a copy of the Client's Bill of Rights and Responsibilities before services start, including advance directives, the emergency plan, out-of-hospital do-not-resuscitate orders, client conduct and responsibilities, and abuse, neglect and exploitation. I have been allowed to take part in planning my care and have received the [state complaint hotline number], which takes complaints 24 hours a day, seven days a week. Licensing information can be obtained by calling [state licensing authority number].",
  ),
  c(
    "Services to be provided",
    "Nursing services are provided by an RN or LPN and may include assessing my needs, providing treatments and giving medicines as ordered by my physician, monitoring my condition and teaching me about my care. Therapy services are provided by a licensed physical, occupational or speech therapist (or an assistant they supervise) and may include assessing my needs, treatment, exercises and teaching to help me regain movement, daily living skills, speech or swallowing. Personal care services include help with bathing, toileting, grooming, shaving, dental care, dressing, eating, housekeeping tasks, walking and transfers. Companion or sitter services include transport and escort, preparing and serving meals, and household tasks essential to cleanliness and safety.",
  ),
  c(
    "Billing",
    "I have the right to be told, before services start, how much of the cost any payer is expected to cover and how much I may have to pay. The Agency has told me, orally and in writing, the cost of the items and services to be provided. I will be told of any change in charges no later than 30 days after the Agency becomes aware of it. My insurance company is {insurer}. It covers {coveragePercent}% of the charges. I am responsible for {clientPerVisit} per visit, which is the balance after insurance pays. A deductible of {deductible} will be billed to me. Charges for supplies used in my care are included in these charges. Assigning my benefits does not reduce my obligation to pay the full fee for services, but I will be credited with all sums collected. I will receive an invoice [every two weeks] for charges not covered by any payer. Payment is due [15] days after the invoice date and a late fee of [10%] of the invoice charges applies to late payments.",
  ),
  c(
    "Cancelling services",
    "I can cancel this service agreement at any time and will only be charged for services given before the Agency is told of the cancellation. The Agency may charge a reasonable amount for travel and staff time if I don't cancel in time to stop the staff member coming to my home. I won't be charged for travel and staff time if the Agency couldn't reach the staff member scheduled to care for me. The Agency will tell me about any charges.",
  ),
  c(
    "Release of information for payment",
    "I authorize the Agency to release medical information requested by local, state or federal agencies, insurance companies or other organizations when needed to pay claims for these home care services. The Agency has told me about its policies on disclosing clinical records.",
  ),
  c(
    "Confidentiality of records",
    "The Agency protects all clinical records against loss, defacement, tampering and use by anyone not authorized. Information that identifies me is confidential and is not released to the public. My written consent is needed to release medical information to anyone not otherwise authorized by law. People who may review my record include surveyors, physicians, payers, and internal and external auditors.",
  ),
  c(
    "Release of records",
    "The Agency only lets people involved in my services see my records. I give written consent for my records to be released to the health care providers treating me.",
  ),
  c(
    "Health care decisions",
    "I have received written information about my right to make health care decisions, including the risks of refusing proposed services, other ways services could be given, and informed consent.",
  ),
  c(
    "When staff aren't there",
    "Agency staff may not be in my home at all times. I, my caregiver or my legal guardian will be responsible for my care when Agency staff are not there.",
  ),
  c("Drug testing", "The Agency does not routinely drug test its employees but may do so at its discretion."),
  c(
    "Charges not covered",
    "The Agency will tell me, in writing and orally, when it becomes aware of charges my payer won't cover. I will be told before any further services are provided.",
  ),
  c("Other home health services", "I certify that no Medicare home health services are being provided to me and that I am not enrolled in an HMO or PPO."),
  c(
    "Hiring Agency staff",
    "I understand that I may not employ Agency employees without first compensating the Agency [amount or terms].",
  ),
  c(
    "Insurance assignment",
    "In return for the services provided, I assign to the Agency any benefits payable to me or for my benefit under my payer's rules, and I ask that these benefits are paid directly to the Agency.",
  ),
  c(
    "Supervision",
    "A Registered Nurse will supervise my care. If I have complaints about the services, I will contact the Registered Nurse in charge of my services.",
  ),
  c(
    "Personal funds and vehicle",
    "I or my responsible party may authorize access to my personal funds when home management services include help with paying bills or shopping, and the use of my vehicle when services include transport and escort. My answers are given below.",
  ),
  c(
    "Rights and complaints",
    "I have received a written copy of my rights and responsibilities. I can make complaints or ask questions about the Agency through [state complaint hotline, hours and address]. I was given the number of the state licensing authority, [licensing authority number], for questions about the Agency's licensing. I was given the name and phone number of the Agency administrator, [administrator name and phone], should I need more information, have questions or want to make a complaint.",
  ),
  c("Rates", "Rates for the Agency's services are set out in this agreement. All rates may change with [2 weeks'] notice to me."),
  c(
    "Payment responsibility and finance charges",
    "I agree to pay all invoices on receipt. Charges not paid within 30 days bear interest of [1.5%] per month. I am liable for all charges, including collection and attorney costs, whoever the payer, unless my agreement with my health plan holds me harmless.",
  ),
  c(
    "Overtime and holiday charges",
    "Services given on holidays, or by the same person at my request for more than 40 hours in a work week, are charged at one and a half times the weekday or weekend rate. Holidays are New Year's Eve, New Year's Day, Independence Day, Labor Day, Memorial Day, Thanksgiving Day, Christmas Eve, Christmas Day and these local holidays: {holidays}.",
  ),
  c(
    "Deposit",
    "{deposit} No interest is earned on a deposit, and it will be applied to {practice}'s last invoice for services.",
  ),
  c(
    "Service interruption",
    "If I receive continuous care from {practice} and service is interrupted, I have arranged for family to support me until service resumes, or I agree that {practice} may arrange my transfer to an appropriate emergency facility.",
  ),
  c(
    "Agreement before services",
    "Services cannot be provided until this agreement has been signed in full. It will be completed before the end of the first visit.",
  ),
  c(
    "Insurance changes",
    "I will tell {practice} within 24 hours of any change to my insurance, such as a new commercial policy, a new Medicare policy or any other change to my primary insurance. I will be responsible for home health services given after a change that stops the Agency billing my insurance, if I didn't tell the Agency before those services were given.",
  ),
];

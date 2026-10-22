# Service agreement: what Tiba asks for and prints

Built 21 Oct 2026 from a US home care agency's service agreement form (structure and wording only; no client details from it are kept). The wording is each practice's own: Tiba ships the default below, and the admin edits it under **Settings → Service agreement**. Have the final wording checked by a lawyer who knows health law where the practice operates.

## Details filled in per client (admin, on the device)

Pre-filled from the patient record where Tiba has it (name, date of birth, date of referral, address, telephone, insurer, services ordered).

| Part | Fields |
|---|---|
| Client | Name, date of birth and date of referral (from the record); address, city, state or county, zip or postal code, telephone; date of initial client contact |
| Emergency contact | Name, relationship (optional), address, city, state, zip, telephone |
| Insurance details | Responsible party (insurer or person paying), address, city, state, zip, telephone; % the insurance covers; what the client pays per visit; deductible billed to the client |
| Services | "I believe my service needs to be" (free text); for RN/LPN visits, Physical therapy (PT), Occupational therapy (OT) and Speech therapy (ST) visits, Personal Care Assistant visits and Companion/sitter visits: ticked or not (pre-ticked when that service is ordered on the patient record), frequency, duration, charge, payer, amount the payer pays, amount the client pays |
| Rates | Weekend and weekday rate for hours or visits, or "not applicable"; other local holidays |
| Deposit | None, cash, check (with check number) or card, and the amount. Card numbers are never stored. |
| Client's answers | Access to personal funds Yes/No; use of personal vehicle Yes/No; accepting or denying the services; initials (confirming the billing, authorizations and rights sections) |
| Who signs | The client; or a responsible party (name and relationship) if the client can't; or "refused to sign" |
| Agency witness | Name and signature (records a refusal on its own) |

Signing needs: the client's address and telephone, a responsible party, at least one service, the witness's name, and, unless refused, the answers and initials. It is refused while the practice's wording still has `[blanks]`. The first signature fixes the wording and details; once complete (both signatures, or a witnessed refusal) the agreement is locked in the database and downloads as a PDF.

## Default wording (practice-editable)

PT, OT and ST were added on 22 Oct 2026. Practices that saved their own wording before then keep it; they can add the therapy sentences under **Settings → Service agreement**.

`{tokens}` are filled in from the agreement; `[blanks]` must be filled in by the practice before anyone can sign.

| Section | Summary |
|---|---|
| Consent to services | Permission for {practice} ("the Agency") to provide nursing, physical, occupational or speech therapy, personal care, companion/sitter or other home care ordered by the physician |
| Client's rights, emergency plan and complaints | Bill of Rights, advance directives, emergency plan, DNR, conduct, abuse/neglect/exploitation; [state complaint hotline number], [state licensing authority number] |
| Services to be provided | What nursing, therapy (PT, OT, ST), personal care and companion services include |
| Billing | Right to know costs; insurer {insurer} covers {coveragePercent}%; client pays {clientPerVisit} per visit; deductible {deductible}; invoices [every two weeks]; due in [15] days; late fee [10%] |
| Cancelling services | Cancel any time; travel and staff time may be charged for late cancellation |
| Release of information for payment | Release to agencies and insurers to pay claims |
| Confidentiality of records | How records are protected and who may review them |
| Release of records | Consent to release to treating providers |
| Health care decisions | Right to make decisions and informed consent |
| When staff aren't there | Client, caregiver or guardian responsible then |
| Drug testing | Not routine; at the Agency's discretion |
| Charges not covered | Client told before further services |
| Other home health services | No Medicare home health services; not in an HMO/PPO (US-specific: remove if it doesn't apply) |
| Hiring Agency staff | Not without compensating the Agency [amount or terms] |
| Insurance assignment | Benefits paid directly to the Agency |
| Supervision | RN supervises; complaints to the RN in charge |
| Personal funds and vehicle | Authorizations (answered in the form) |
| Rights and complaints | [state complaint hotline, hours and address], [licensing authority number], [administrator name and phone] |
| Rates | Rates may change with [2 weeks'] notice |
| Payment responsibility and finance charges | Interest of [1.5%] a month after 30 days; collection costs |
| Overtime and holiday charges | Time and a half; listed holidays plus {holidays} |
| Deposit | {deposit} (the sentence for the chosen deposit, or "No deposit is required.") |
| Service interruption | Family support or transfer to an emergency facility |
| Agreement before services | Signed before the end of the first visit |
| Insurance changes | Tell the Agency within 24 hours |

## Open points for the practice's lawyer

1. **Hiring Agency staff:** the source form's wording ("…compensating the Agency or employee's annual wages, which is even greater") is unclear, so the default leaves the amount as a blank.
2. **US-specific clauses** (Medicare/HMO, state hotline and licensing) need replacing or removing for practices outside the US.
3. **Copies:** should the client get the signed PDF by email automatically?
4. **Changes of care:** should a new agreement be required when services, rates or the payer change? Today a signed agreement stays as it was.

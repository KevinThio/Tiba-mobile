import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireReferrer } from "@/lib/auth";
import { insurersFor } from "@/lib/patient-options";
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_MAX } from "@/lib/portal";
import { ReferralForm } from "./referral-form";

/** Make a referral (referral portal). Only confirmed referral sources can send one. */
export default async function NewReferralPage() {
  const referrer = await requireReferrer();
  if (referrer.status !== "active") redirect("/referrer");
  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/referrer", label: "Referrals" }}
        overline={referrer.practiceName}
        title="Make a referral"
        description={`${referrer.practiceName} checks the patient's details and cover, then accepts or declines the referral.`}
      />
      <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <ReferralForm
          insurers={insurersFor(referrer.country)}
          attachments={{ url: "/api/referral/attachments", max: ATTACHMENTS_MAX, maxBytes: ATTACHMENT_MAX_BYTES }}
          practiceName={referrer.practiceName}
        />
      </section>
    </div>
  );
}

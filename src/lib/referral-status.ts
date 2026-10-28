// Referral statuses and the list filters, shared by the portal, the admin screens and the browser.

export type ReferralStatus = "pending" | "accepted" | "declined";

export const REFERRAL_STATUS: Record<ReferralStatus, { label: string; badge: "warning" | "success" | "danger" }> = {
  pending: { label: "Waiting", badge: "warning" },
  accepted: { label: "Accepted", badge: "success" },
  declined: { label: "Declined", badge: "danger" },
};

/** List filters (`?show=`): every referral, or one status. */
export const REFERRAL_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Waiting" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
] as const;

export type ReferralFilter = (typeof REFERRAL_FILTERS)[number]["key"];

export const isReferralFilter = (v: unknown): v is ReferralFilter => REFERRAL_FILTERS.some((f) => f.key === v);

/** Self-pay referrals don't need an insurance ID. */
export const isSelfPay = (insurer: string) => /^self[- ]?pay$/i.test(insurer.trim());

export const REFERRAL_LIMITS = { patientName: 120, insurer: 120, insuranceId: 60, note: 1000, decisionNote: 500 } as const;

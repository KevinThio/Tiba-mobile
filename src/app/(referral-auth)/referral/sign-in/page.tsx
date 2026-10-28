import { PortalSignIn } from "@/components/portal-sign-in";

/** Referral portal sign-in (referral sources: hospitals, doctors, agencies). */
export default function ReferralSignInPage() {
  return (
    <PortalSignIn
      title="Referral source sign in"
      intro="Send referrals and documents to the practice you work with."
      signUp={{ href: "/referral/sign-up", label: "Create your referral account" }}
    />
  );
}

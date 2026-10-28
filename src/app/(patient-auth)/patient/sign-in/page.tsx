import { PortalSignIn } from "@/components/portal-sign-in";

/** Patient portal sign-in. */
export default function PatientSignInPage() {
  return (
    <PortalSignIn
      title="Patient sign in"
      intro="Message your practice from your patient portal."
      signUp={{ href: "/patient/sign-up", label: "Create your patient account" }}
    />
  );
}

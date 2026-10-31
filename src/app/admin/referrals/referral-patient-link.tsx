import { Megaphone, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * On an accepted referral: add the patient and offer them to the clinicians who do their care,
 * or open the patient once they're added.
 */
export function ReferralPatientLink({ referralId, patientId }: { referralId: string; patientId: string | null }) {
  if (patientId) {
    return (
      <Button size="sm" variant="outline" className="w-fit" nativeButton={false} render={<Link href={`/admin/patients/${patientId}#offer`} />}>
        <UserRound aria-hidden />
        Open patient
      </Button>
    );
  }
  return (
    <Button size="sm" className="w-fit" nativeButton={false} render={<Link href={`/admin/patients/new?referral=${referralId}`} />}>
      <Megaphone aria-hidden />
      Add patient and offer to clinicians
    </Button>
  );
}

import { FileUp, MailCheck, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";

const HIGHLIGHTS = [
  { icon: FileUp, text: "Send referrals and documents securely" },
  { icon: ShieldCheck, text: "The practice confirms who you are first" },
  { icon: MailCheck, text: "Get an email when they reply" },
];

/** The referral portal's sign-in and sign-up (staff use the (auth) pages). */
export default function ReferralAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame
      home="/referral/sign-in"
      headline="Send referrals straight to the practice."
      highlights={HIGHLIGHTS}
      panelNote="Only you and the practice can read your messages and documents."
      footer="Your messages and documents are private. Only the practice can read them."
    >
      {children}
    </AuthFrame>
  );
}

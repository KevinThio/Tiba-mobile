import { MailCheck, MessagesSquare, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";

const HIGHLIGHTS = [
  { icon: MessagesSquare, text: "Message your practice any time" },
  { icon: ShieldCheck, text: "Your practice confirms it's you first" },
  { icon: MailCheck, text: "Get an email when they reply" },
];

/** The patient portal's sign-in and sign-up (staff use the (auth) pages). */
export default function PatientAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame
      home="/patient/sign-in"
      headline="Talk to your practice, privately."
      highlights={HIGHLIGHTS}
      panelNote="Only you and your practice can read your messages."
      footer="Your messages are private. Only your practice can read them."
    >
      {children}
    </AuthFrame>
  );
}

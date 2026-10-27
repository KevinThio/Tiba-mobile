import { CalendarDays, PenLine, Search } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";

const HIGHLIGHTS = [
  { icon: CalendarDays, text: "Book visits in a tap" },
  { icon: PenLine, text: "Write and sign notes in one place" },
  { icon: Search, text: "Find any note again in seconds" },
];

/** Sign-in, sign-up, 2FA, password reset, the waiting page and patient reviews. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame
      home="/sign-in"
      headline="Your notes, signed and safe in one place."
      highlights={HIGHLIGHTS}
      panelNote="Private by design. Patient records stay inside your practice."
      footer="Your patients' notes are private and stored safely."
    >
      {children}
    </AuthFrame>
  );
}

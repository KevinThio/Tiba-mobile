import { CalendarDays, ReceiptText, UsersRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// The visit note is opened from an appointment, so it has no nav entry.
export const NAV_ITEMS: NavItem[] = [
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: UsersRound },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

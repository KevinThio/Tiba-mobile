import {
  Bell,
  CalendarDays,
  ChartColumn,
  CircleUserRound,
  FileCheck,
  FilePenLine,
  FileSignature,
  Landmark,
  LayoutDashboard,
  MapPin,
  Menu,
  MessagesSquare,
  ReceiptText,
  Settings,
  Star,
  Stethoscope,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/** `exact` items are only active on their own path (used for app home pages like /admin). */
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };
/** `also` lists other paths that keep a phone tab lit (screens reached from that tab). */
export type TabItem = NavItem & { also?: string[] };

// ---------------------------------------------------------------------------
// Clinician app, from the v2 prototype. The visit note, sign note and signed note
// are opened from an appointment or a draft, so they have no nav entry.
// ---------------------------------------------------------------------------

/** Desktop side menu. Invoices is kept from v1.1 (the prototype starts invoices from a patient or signed note). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/notes", label: "Notes to do", icon: FilePenLine },
  { href: "/patients", label: "Patients", icon: UsersRound },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/contracts", label: "Contracts", icon: FileSignature },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const NAV_GROUPS: NavGroup[] = [{ items: NAV_ITEMS }];

/** Phone bottom tabs. Account is the Settings screen, which also links to Profile, Contracts, Notifications and Invoices. */
export const TAB_ITEMS: TabItem[] = [
  { href: "/appointments", label: "Visits", icon: CalendarDays },
  { href: "/notes", label: "Notes", icon: FilePenLine },
  { href: "/patients", label: "Patients", icon: UsersRound },
  {
    href: "/settings",
    label: "Account",
    icon: CircleUserRound,
    also: ["/profile", "/contracts", "/notifications", "/invoices"],
  },
];

// ---------------------------------------------------------------------------
// Admin app, from the v2 prototype (TibaAdmin). Admins never write notes.
// ---------------------------------------------------------------------------

export type AdminSection = NavItem & { overline: string; description: string };

/** Every admin screen in the side menu, with the header copy its placeholder uses. */
export const ADMIN_SECTIONS = {
  overview: { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, overline: "Admin", description: "What needs your attention, and today's visits across the practice." },
  notifications: { href: "/admin/notifications", label: "Notifications", icon: Bell, overline: "For you", description: "New invoices, possible duplicates, reviews, contracts and notes waiting to be billed." },
  performance: { href: "/admin/performance", label: "Performance", icon: ChartColumn, overline: "Practice performance", description: "Admissions, invoices, missed visits and reviews for a period you pick." },
  clinicians: { href: "/admin/clinicians", label: "Clinicians", icon: Stethoscope, overline: "Your team", description: "Accounts, documents, emergency contacts and contracts." },
  patients: { href: "/admin/patients", label: "Patients", icon: UsersRound, overline: "Your practice", description: "Active and discharged patients, service agreements and possible duplicates." },
  messages: { href: "/admin/messages", label: "Patient messages", icon: MessagesSquare, overline: "Patient portal", description: "Messages from your patients, and patients asking to join the portal." },
  appointments: { href: "/admin/appointments", label: "Appointments", icon: CalendarDays, overline: "Upcoming", description: "Upcoming visits for every clinician, grouped by day." },
  notes: { href: "/admin/notes", label: "Completed notes", icon: FileCheck, overline: "All clinicians", description: "Every signed note, newest first. Drafts stay private to each clinician until signed." },
  invoices: { href: "/admin/invoices", label: "Invoices", icon: ReceiptText, overline: "Sent by your clinicians", description: "Mark invoices paid, or flag an issue for the clinician to fix." },
  billing: { href: "/admin/billing", label: "Insurance billing", icon: Landmark, overline: "Notes billed to insurance", description: "Signed notes waiting to be billed, oldest first. Red means more than 30 days." },
  contracts: { href: "/admin/contracts", label: "Contracts", icon: FileSignature, overline: "Your team", description: "Create, sign and share contracts with your clinicians." },
  locations: { href: "/admin/locations", label: "Locations", icon: MapPin, overline: "Your practice", description: "Addresses, services and files for each place you see patients." },
  reviews: { href: "/admin/reviews", label: "Patient reviews", icon: Star, overline: "From your patients", description: "Only admins can see these. Patients send them from the sign-in page." },
  settings: { href: "/admin/settings", label: "Settings", icon: Settings, overline: "Your practice", description: "Practice name, country and logo." },
} satisfies Record<string, AdminSection>;

const A = ADMIN_SECTIONS;

/** Desktop side menu, grouped as in the prototype. */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  { items: [A.overview, A.notifications, A.performance] },
  { label: "People", items: [A.clinicians, A.patients, A.messages] },
  { label: "Work", items: [A.appointments, A.notes, A.invoices, A.billing] },
  { label: "Practice", items: [A.contracts, A.locations, A.reviews, A.settings] },
];

/** Phone tabs: Overview, Patients, Billing, More. More holds every other screen. */
export const ADMIN_TAB_ITEMS: TabItem[] = [
  { ...A.overview, label: "Overview" },
  { ...A.patients, label: "Patients" },
  { ...A.billing, label: "Billing" },
  {
    href: "/admin/more",
    label: "More",
    icon: Menu,
    also: [A.notifications, A.messages, A.contracts, A.performance, A.invoices, A.clinicians, A.appointments, A.notes, A.locations, A.reviews, A.settings].map((s) => s.href),
  },
];

/** Rows on the admin phone More screen, with the prototype's one-line summaries. */
export const ADMIN_MORE_ITEMS: (NavItem & { meta: string })[] = [
  { ...A.notifications, meta: "What needs you" },
  { ...A.messages, meta: "Patients write to you from the portal" },
  { ...A.contracts, meta: "Create, sign and share with clinicians" },
  { ...A.performance, meta: "Admissions, invoices, missed visits, reviews" },
  { ...A.invoices, meta: "Mark paid or flag issues" },
  { ...A.clinicians, meta: "Accounts, documents, emergency contacts" },
  { ...A.appointments, meta: "Upcoming visits across the practice" },
  { ...A.notes, meta: "Signed notes from your clinicians" },
  { ...A.locations, meta: "Addresses, services and files" },
  { ...A.reviews, meta: "Only you can see these" },
  { ...A.settings, meta: "Practice name and logo" },
];

export function isActive(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

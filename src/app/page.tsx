import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, homeFor } from "@/lib/auth";

/** Sends each account type to its own app: clinicians to Appointments, admins to Overview. */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  redirect(homeFor(session.user.role));
}

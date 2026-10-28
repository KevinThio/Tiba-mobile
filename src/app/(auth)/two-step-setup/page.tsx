import { redirect } from "next/navigation";
import { homeFor, requireAccount } from "@/lib/auth";
import { TwoStepSetup } from "./two-step-setup";

/**
 * Turn on two-step sign-in. Required for admins (requireAdmin sends them here until it's on);
 * other accounts go home.
 */
export default async function TwoStepSetupPage() {
  const user = await requireAccount();
  if (user.role !== "admin") redirect(homeFor(user));
  if (user.twoFactorEnabled) redirect("/admin");
  return <TwoStepSetup />;
}

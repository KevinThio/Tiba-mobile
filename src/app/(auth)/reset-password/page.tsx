import { LinkExpired } from "./link-expired";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Opened from the reset email. Better Auth checks the link at /api/auth/reset-password/:token
 * and sends people here with ?token=… (or ?error=INVALID_TOKEN when it has expired or was used).
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || !token || error) return <LinkExpired />;
  return <ResetPasswordForm token={token} />;
}

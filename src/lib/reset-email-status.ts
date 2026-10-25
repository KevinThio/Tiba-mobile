import "server-only";

// Better Auth catches a failed reset email and only logs it, so the forgot-password page would
// say "check your inbox" when nothing was sent. sendResetPassword (auth.ts) notes the account
// here when sending fails, and requestPasswordResetLink checks it straight after (Better Auth
// awaits the send in the same request).
const failed = new Set<string>();

export const noteResetEmailFailed = (userId: string) => void failed.add(userId);

/** True (once) when the last reset email for this account failed to send. */
export function resetEmailFailed(userId: string) {
  return failed.delete(userId);
}

/**
 * The page to return to after signing in, from `?next=`. Only paths inside Tiba are
 * allowed ("/admin/reviews"), never another site ("//evil.example" or "https://…").
 */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

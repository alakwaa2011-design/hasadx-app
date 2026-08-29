export const CONFIGURED_ADMIN_EMAILS = [
  "alakwaa2011@gmail.com",
  "marwanakwaa@yahoo.com",
] as const;

const CONFIGURED_ADMIN_EMAIL_SET = new Set(CONFIGURED_ADMIN_EMAILS);

export function isConfiguredAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && CONFIGURED_ADMIN_EMAIL_SET.has(email.trim().toLowerCase() as (typeof CONFIGURED_ADMIN_EMAILS)[number]);
}
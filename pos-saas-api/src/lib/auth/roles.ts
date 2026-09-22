export const tenantRoles = ["admin", "manager", "cashier", "kitchen", "waiter", "staff"] as const;
export const globalRoles = [
  "platform_owner",
  "platform_admin",
  "support_agent",
  "billing_admin",
  "security_auditor",
] as const;
export function isGlobalRole(role: string) {
  return (globalRoles as readonly string[]).includes(role);
}

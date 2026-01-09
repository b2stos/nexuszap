/**
 * Super Admin Override Configuration
 * 
 * TEMPORARY: This file controls the super admin override by email.
 * To remove this feature in the future, simply:
 * 1. Delete this file
 * 2. Remove imports/usage from useTenantRole.ts and other files
 * 
 * The super admin bypasses all RBAC and tenant restrictions.
 */

// Email(s) that have super admin access
const SUPER_ADMIN_EMAILS: string[] = [
  "bbastosb2@gmail.com",
];

/**
 * Check if the given email is a super admin
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * List of super admin emails (for reference/debugging)
 */
export function getSuperAdminEmails(): string[] {
  return [...SUPER_ADMIN_EMAILS];
}

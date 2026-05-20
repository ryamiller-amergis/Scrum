import { and, eq } from 'drizzle-orm';
import { db } from '../db/drizzle';
import { appRoles, appUserRoles } from '../db/schema';

/**
 * Returns true if the given userId has the 'admin' role assigned.
 * Used by service-layer functions to bypass author-only restrictions for admins.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(appUserRoles)
    .innerJoin(appRoles, eq(appUserRoles.roleId, appRoles.id))
    .where(and(eq(appUserRoles.userId, userId), eq(appRoles.name, 'admin')));
  return rows.length > 0;
}

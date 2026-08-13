export const SUPER_ADMIN_ROLE = "Super Administrator";
export const CLIENT_ADMIN_ROLE = "Client Administrator";

export function isSuperAdminUser(user) {
  if (!user) return false;
  if (user.uid === "admin_local" || user.isSuperAdmin === true) return true;

  // Keep older administrator profiles working while distinguishing newly
  // provisioned, website-scoped client administrators.
  return (
    (user.role === SUPER_ADMIN_ROLE || user.role === "Administrator")
    && !user.websiteId
    && !user.websiteIds
  );
}

export function getAccessibleWebsiteIds(user) {
  if (!user || isSuperAdminUser(user)) return [];

  const ids = new Set();
  if (user.websiteId) ids.add(String(user.websiteId));

  if (Array.isArray(user.websiteIds)) {
    user.websiteIds.filter(Boolean).forEach((id) => ids.add(String(id)));
  } else if (user.websiteIds && typeof user.websiteIds === "object") {
    Object.entries(user.websiteIds).forEach(([id, allowed]) => {
      if (allowed) ids.add(String(id));
    });
  }

  return Array.from(ids);
}

export function userCanAccessWebsite(user, websiteId) {
  if (!user || !websiteId) return false;
  if (isSuperAdminUser(user)) return true;
  return getAccessibleWebsiteIds(user).includes(String(websiteId));
}

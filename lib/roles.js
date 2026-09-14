export const STAFF_ROLES = ["admin", "staff"];
export const ALL_ROLES = ["admin", "staff", "customer"];

export const ROLE_SCOPES = {
  admin: ["*"],
  staff: ["dashboard", "leads", "users:read"],
  customer: [],
};

export const ROLE_LABELS = {
  admin: "Admin",
  staff: "Staff",
  customer: "Customer",
};

export function hasScope(user, scope) {
  if (!user || user.status !== "active") return false;
  const scopes = ROLE_SCOPES[user.role] || [];
  return scopes.includes("*") || scopes.includes(scope);
}

export function canManageUsers(user) {
  return hasScope(user, "*");
}

export function isStaffUser(user) {
  return Boolean(user && STAFF_ROLES.includes(user.role) && user.status === "active");
}

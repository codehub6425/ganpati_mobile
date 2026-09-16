export const DEFAULT_STAFF_PASSWORD = "welcome@123";

export function userMustChangePassword(user) {
  return Boolean(user?.must_change_password);
}

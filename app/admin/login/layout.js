import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function AdminLoginLayout({ children }) {
  try {
    const user = await getSessionUser();
    if (user) redirect("/admin");
  } catch {
    // Keep the login form available if the session check fails.
  }

  return children;
}

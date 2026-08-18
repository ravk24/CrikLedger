import { redirect } from "next/navigation";

// Signing in stopped being an admin-only act at Feature 4 — anyone can
// hold an account. The canonical page is /login; this path stays so old
// links and bookmarks keep working.
export default function AdminLoginRedirect() {
  redirect("/login");
}

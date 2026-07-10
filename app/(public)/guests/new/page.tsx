import { redirect } from "next/navigation";

/**
 * /guests/new — legacy redirect.
 * canonical은 /admin/guests/new.
 */
export default function LegacyNewGuestPage() {
  redirect("/admin/guests/new");
}

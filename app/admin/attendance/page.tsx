import { getAdminAccessServer } from "@/lib/admin-permissions";
import AdminAttendancePageClient from "./AdminAttendancePageClient";

export default async function AdminAttendancePage() {
  const access = await getAdminAccessServer();
  return <AdminAttendancePageClient currentClubId={access.clubId ?? ""} />;
}

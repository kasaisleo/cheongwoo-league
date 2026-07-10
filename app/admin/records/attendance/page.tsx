import { getAdminAccessServer } from "@/lib/admin-permissions";
import AttendanceRecordsPageClient from "./AttendanceRecordsPageClient";

export default async function AdminRecordsAttendancePage() {
  const access = await getAdminAccessServer();
  return <AttendanceRecordsPageClient currentClubId={access.clubId ?? ""} />;
}

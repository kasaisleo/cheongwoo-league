import { getAdminAccessServer } from "@/lib/admin-permissions";
import MatchRecordsPageClient from "./MatchRecordsPageClient";

export default async function AdminRecordsMatchesPage() {
  const access = await getAdminAccessServer();
  return <MatchRecordsPageClient currentClubId={access.clubId ?? ""} />;
}

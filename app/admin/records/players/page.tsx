import { getAdminAccessServer } from "@/lib/admin-permissions";
import PlayerRecordsPageClient from "./PlayerRecordsPageClient";

export default async function AdminRecordsPlayersPage() {
  const access = await getAdminAccessServer();
  return <PlayerRecordsPageClient currentClubId={access.clubId ?? ""} />;
}

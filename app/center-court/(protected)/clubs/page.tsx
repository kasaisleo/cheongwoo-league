import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { ClubRegistryPageClient } from "./ClubRegistryPageClient";

export const dynamic = "force-dynamic";

export interface ClubRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: string;
}

async function getClubs(): Promise<ClubRow[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status, created_at")
    .order("created_at", { ascending: true });
  return (data ?? []) as ClubRow[];
}

export default async function ClubRegistryPage() {
  const [session, clubs] = await Promise.all([
    getPlatformAdminSession(),
    getClubs(),
  ]);
  const isOwner = session?.role === "owner";
  return <ClubRegistryPageClient clubs={clubs} isOwner={isOwner} />;
}

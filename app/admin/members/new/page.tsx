import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { NewMemberClient } from "./NewMemberClient";
import { GuestRegistrationForm } from "./GuestRegistrationForm";

interface PageProps {
  searchParams: { type?: string };
}

export default async function NewMemberPage({ searchParams }: PageProps) {
  const type = searchParams.type;
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";
  if (!currentClubId) redirect("/admin");

  if (type === "guest") {
    return <GuestRegistrationForm currentClubId={currentClubId} />;
  }

  const supabase = createServiceClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", currentClubId)
    .maybeSingle();

  return <NewMemberClient type="member" currentClubName={club?.name ?? ""} />;
}

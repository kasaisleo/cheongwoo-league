import { NewMemberClient } from "./NewMemberClient";
import { GuestRegistrationForm } from "./GuestRegistrationForm";
import { getCurrentClubId } from "@/lib/current-club";

interface PageProps {
  searchParams: { type?: string };
}

export default async function NewMemberPage({ searchParams }: PageProps) {
  const type = searchParams.type;

  if (type === "guest") {
    const currentClubId = await getCurrentClubId();
    return <GuestRegistrationForm currentClubId={currentClubId} />;
  }
  return <NewMemberClient type="member" />;
}

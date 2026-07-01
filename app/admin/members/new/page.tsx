import { NewMemberClient } from "./NewMemberClient";
import { GuestRegistrationForm } from "./GuestRegistrationForm";

interface PageProps {
  searchParams: { type?: string };
}

export default function NewMemberPage({ searchParams }: PageProps) {
  const type = searchParams.type;

  if (type === "guest") return <GuestRegistrationForm />;
  return <NewMemberClient type="member" />;
}

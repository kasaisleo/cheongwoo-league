import { NewMemberClient } from "./NewMemberClient";

interface PageProps {
  searchParams: { type?: string };
}

export default function NewMemberPage({ searchParams }: PageProps) {
  const type = searchParams.type === "guest" ? "guest" : "member";
  return <NewMemberClient type={type} />;
}

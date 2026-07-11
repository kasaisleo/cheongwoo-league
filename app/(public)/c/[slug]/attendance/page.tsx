import { Suspense } from "react";
import { requirePublicClubBySlug } from "@/lib/public-club";
import AttendancePageClient from "@/app/(public)/attendance/AttendancePageClient";

export const dynamic = "force-dynamic";

export default async function ClubAttendancePage({ params }: { params: { slug: string } }) {
  const club = await requirePublicClubBySlug(params.slug);

  return (
    <Suspense>
      <AttendancePageClient currentClubId={club.id} clubSlug={club.slug} />
    </Suspense>
  );
}

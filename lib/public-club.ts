import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PublicClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

/**
 * slug로 active 클럽을 조회한다.
 * inactive / 존재하지 않는 slug → notFound() 호출.
 */
export async function requirePublicClubBySlug(slug: string): Promise<PublicClub> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!data) notFound();
  return data as PublicClub;
}

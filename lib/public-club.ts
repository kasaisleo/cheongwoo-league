import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PublicClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  skin_key: string;
  appearance_config: Record<string, unknown>;
}

/**
 * slug로 active 클럽을 조회한다.
 * inactive / 존재하지 않는 slug → notFound() 호출.
 *
 * React cache()로 래핑되어 같은 요청 내 layout과 page가 동일 slug로
 * 호출해도 DB 쿼리는 한 번만 실행된다.
 */
export const requirePublicClubBySlug = cache(
  async (slug: string): Promise<PublicClub> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clubs")
      .select("id, name, slug, description, skin_key, appearance_config")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (!data) notFound();
    return data as PublicClub;
  }
);

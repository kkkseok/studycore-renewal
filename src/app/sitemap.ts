import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const baseUrl = "https://studycore.kr";

// 정적 페이지는 lastModified를 넣지 않는다 — 빌드할 때마다 현재 시각이 찍히면
// 실제로 바뀌지 않은 페이지도 "갱신됨"으로 보여 검색엔진이 lastmod를 신뢰하지 않게 된다.
// 로그인 필요 페이지(/guide 등 middleware 보호 라우트)는 넣지 않는다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/system`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/consult`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/manual`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // 블로그 게시글·후기 — 쿠키 불필요한 공개 데이터 조회
  let blogPages: MetadataRoute.Sitemap = [];
  let reviewPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const [{ data: posts }, { count: reviewCount }] = await Promise.all([
      supabase
        .from("blog_posts")
        .select("slug, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("is_visible", true),
    ]);

    blogPages = (posts ?? []).map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // 공개 후기가 있을 때만 /reviews를 노출 (0건이면 /reviews는 noindex — reviews/layout.tsx)
    if ((reviewCount ?? 0) > 0) {
      reviewPages = [
        { url: `${baseUrl}/reviews`, changeFrequency: "weekly", priority: 0.7 },
      ];
    }
  } catch {
    // DB 조회 실패 시 정적 페이지만 반환
  }

  return [...staticPages, ...reviewPages, ...blogPages];
}

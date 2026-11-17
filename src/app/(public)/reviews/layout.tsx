import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getReviewStats } from "@/domains/review/service";

// 공개 후기가 0건이면 내용 없는 페이지가 색인되지 않도록 noindex (팔로우는 유지).
// 조회 실패 시에는 색인을 막지 않는다.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { stats } = await getReviewStats(supabase);
  const isEmpty = stats?.total === 0;

  return {
    title: "수강 후기",
    description:
      "광주 광산구 수완지구 관리형 독서실 스터디코어 1.0 재원생 및 학부모 후기. 실제 이용 경험을 확인하세요.",
    alternates: {
      canonical: "https://studycore.kr/reviews",
    },
    ...(isEmpty && { robots: { index: false, follow: true } }),
  };
}

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

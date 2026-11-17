import type { Metadata } from "next";

// 상위 notices/layout.tsx의 canonical(/notices)을 상속하지 않도록 상세 페이지 자체 값을 지정.
// 공지 상세는 robots.txt에서 크롤링을 막고 있어(Disallow: /notices/) 색인 대상이 아니므로 noindex로 맞춘다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    // 상위 레이아웃의 문자열 title이 템플릿 상속을 끊으므로 전체 제목을 직접 지정
    title: { absolute: "공지사항 | 스터디코어 1.0" },
    alternates: {
      canonical: `https://studycore.kr/notices/${id}`,
    },
    robots: { index: false, follow: true },
  };
}

export default function NoticeDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

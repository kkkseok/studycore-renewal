import type { Metadata } from "next";

// notices/page.tsx가 클라이언트 컴포넌트라 metadata를 둘 수 없어 레이아웃에서 지정.
// 없으면 홈 title·description을 그대로 상속해 홈과 중복 페이지로 보인다.
export const metadata: Metadata = {
  title: "공지사항",
  description:
    "광주 광산구 관리형 독서실 스터디코어 1.0 공지사항. 윈터·썸머스쿨 모집, 운영 일정, 등록 안내를 확인하세요.",
  alternates: {
    canonical: "https://studycore.kr/notices",
  },
};

export default function NoticesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

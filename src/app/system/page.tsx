import { Metadata } from "next";
import { Nav, Footer } from "@/components/common";
import { SystemPageContent } from "@/components/system/SystemPageContent";

export const metadata: Metadata = {
  title: "관리형 독서실 운영 시스템",
  description:
    "광산구 관리형 독서실 스터디코어 1.0의 운영 시스템 — 교시제 시간표, 턴게이트 출결·보호자 알림, 휴대폰 수거 등 6대 핵심 시스템으로 자습 시간과 집중 환경을 관리합니다.",
  alternates: {
    canonical: "https://studycore.kr/system",
  },
};

export default function SystemPage() {
  return (
    <>
      <Nav />
      <main className="page-body">
        <SystemPageContent />
      </main>
      <Footer />
    </>
  );
}

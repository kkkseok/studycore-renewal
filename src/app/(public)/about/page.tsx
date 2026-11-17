import type { Metadata } from "next";
import { Nav, Footer } from "@/components/common";
import {
  IntroSection,
  FacilitySection,
  LocationSection,
} from "@/components/about";

export const metadata: Metadata = {
  title: "독서실 소개 · 시설 · 오시는 길",
  description:
    "광주 광산구 수완지구 관리형 독서실 스터디코어 1.0 소개. 시설과 좌석 환경, 교시제 운영 방식, 임방울대로 330 애플타워 10층 오시는 길을 확인하세요.",
  alternates: {
    canonical: "https://studycore.kr/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="pt-16">
        <IntroSection />
        <FacilitySection />
        <LocationSection />
      </main>
      <Footer />
    </>
  );
}

import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR, Noto_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";
import { Providers } from "@/components/Providers";
import "./globals.css";

const notoSerifKR = Noto_Serif_KR({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#103050",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://studycore.kr"),
  title: {
    default: "광주 광산구 관리형 독서실 | 스터디코어 1.0",
    template: "%s | 스터디코어 1.0",
  },
  description:
    "광주 광산구 수완지구 관리형 독서실 스터디코어 1.0. 교시제 시간표, 턴게이트 출결·보호자 알림, 휴대폰 수거, AI 수학 질문방, 대표원장 직접 관리로 중·고등학생과 N수생의 자습을 관리합니다.",
  keywords: [
    "관리형 독서실",
    "광산구 관리형 독서실",
    "수완지구 독서실",
    "광주 독서실",
    "광산구 독서실",
    "관리형 학습공간",
    "광주 관리형 학습공간",
    "스터디코어",
    "STUDYCORE",
    "교시제 독서실",
    "수학 질문방",
    "자기주도학습",
    "광주 학원",
    "광산구 학원",
    "중등 독서실",
    "고등 독서실",
    "독서실 추천",
    "광주 스터디카페",
  ],
  authors: [{ name: "스터디코어 1.0" }],
  creator: "스터디코어 1.0",
  publisher: "스터디코어 1.0",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "스터디코어",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://studycore.kr",
    siteName: "스터디코어 1.0",
    title: "광주 광산구 관리형 독서실 | 스터디코어 1.0",
    description:
      "광산구 수완지구 관리형 독서실 — 교시제 시간표, 턴게이트 출결, 휴대폰 수거, AI 수학 질문방, 대표원장 직접 관리",
  },
  twitter: {
    card: "summary_large_image",
    title: "광주 광산구 관리형 독서실 | 스터디코어 1.0",
    description:
      "광산구 수완지구 관리형 독서실 — 교시제 시간표, 턴게이트 출결, 휴대폰 수거, 대표원장 직접 관리",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "9ik0KxF9cQ1CoU2se5isPlTzkcbWb3KEVaLKHRs7byE",
    other: {
      "naver-site-verification": "71796639eb31c6c6f6263517b605d763b76f230e",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${notoSerifKR.variable} ${notoSansKR.variable} ${ibmPlexMono.variable} font-sans antialiased flex flex-col min-h-dvh`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[9999] focus:bg-navy focus:text-white focus:px-6 focus:py-3 focus:text-body focus:font-bold"
        >
          본문으로 건너뛰기
        </a>
        <MetaPixel />
        <GoogleAnalytics />
        <Providers><div id="main-content" className="flex flex-col flex-1">{children}</div></Providers>
      </body>
    </html>
  );
}

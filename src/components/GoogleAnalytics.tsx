"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useInsertionEffect } from "react";
import {
  GA_DISABLE_KEY,
  GA_INTERNAL_FLAG_KEY,
  GA_MEASUREMENT_ID,
  isInternalBrowser,
  setAnalyticsDisabled,
  setAnalyticsUser,
  trackLinkClick,
} from "@/lib/analytics";
import { useUserStore } from "@/stores/useUserStore";

const isAdminPath = (pathname: string | null) => pathname?.startsWith("/admin") ?? false;

/**
 * GA4 (gtag.js 직접 설치, GTM 미사용)
 *
 * - page_view: config 기본 전송 + GA4 향상된 측정의 "브라우저 기록 기반 페이지 변경"이
 *   클라이언트 라우팅 전환을 잡는다. 여기서 page_view를 따로 보내지 않는다(중복 방지).
 * - /admin: 첫 진입이 어드민이면 스크립트를 로드하지 않고, 공개 페이지에서 어드민으로
 *   이동하면 `ga-disable-<ID>` 플래그로 전송을 끈다.
 * - 클릭 추적: 문서 전체 위임 리스너 1개로 전화·카카오톡 채널·상담 링크 클릭을 기록.
 *   위치는 가장 가까운 `data-track-location` 조상 값(없으면 pathname).
 * - 사용자 구분: 로그인 상태 확정 후 user_type(guest·student) 설정. 스태프가 로그인한 브라우저는
 *   localStorage 표시 후 GA 전송을 끈다(lib/analytics.ts GA_INTERNAL_FLAG_KEY 참고).
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const isAdmin = isAdminPath(pathname);
  const role = useUserStore((s) => s.role);
  const isAuthLoading = useUserStore((s) => s.isLoading);

  // Next 라우터의 history.pushState(부모의 insertion effect)보다 먼저 실행되어야
  // 향상된 측정이 어드민 경로의 page_view를 보내기 전에 플래그가 켜진다.
  useInsertionEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    setAnalyticsDisabled(isAdmin || isInternalBrowser());
  }, [isAdmin]);

  useEffect(() => {
    if (isAuthLoading) return;
    setAnalyticsUser(role);
  }, [role, isAuthLoading]);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement) trackLinkClick(anchor);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 어드민에서는 렌더하지 않는다. 공개 페이지에서 이미 로드된 스크립트는 남지만 위 플래그가 전송을 막고,
  // 공개 페이지로 돌아오면 next/script가 id로 중복 실행을 막는다.
  if (!GA_MEASUREMENT_ID || isAdmin) return null;

  // 스태프 브라우저는 config(첫 page_view) 전에 전송을 끈다.
  const initScript = `window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());try{if(localStorage.getItem('${GA_INTERNAL_FLAG_KEY}')==='1')window['${GA_DISABLE_KEY}']=true;}catch(e){}window.gtag('config','${GA_MEASUREMENT_ID}');`;

  return (
    <>
      <Script
        id="ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {initScript}
      </Script>
    </>
  );
}

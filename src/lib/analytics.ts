/**
 * GA4 이벤트 전송 헬퍼 (클라이언트 전용)
 *
 * - 측정 ID(`NEXT_PUBLIC_GA_MEASUREMENT_ID`)가 없거나 gtag가 아직 없으면 아무것도 하지 않는다.
 *   분석 전송 실패가 화면 동작(폼 제출·이동)을 막지 않게 하기 위함.
 * - 이름·전화번호·학교명·문의 내용 등 개인정보는 절대 params에 넣지 않는다.
 * - 이벤트 설계: Drive `10_projects/studycore-renewal/analytics/ga4-tracking-plan.md`
 */

import { ROLES, isStaffRole } from "@/lib/constants";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * 스태프가 한 번이라도 로그인한 브라우저 표시 (localStorage).
 * 이 표시가 있으면 GA 전송을 끈다(`ga-disable-<ID>`). GA 초기화 스크립트(GoogleAnalytics.tsx·
 * 랜딩 게이트웨이)가 config 전에 읽어 첫 page_view부터 막는다.
 * traffic_type=internal 방식은 쓰지 않는다: gtag가 자동 page_view에는 traffic_type을 붙이지 않아
 * (2026-11-17 실측) 스태프 페이지 조회가 내부 트래픽 필터를 통과한다.
 * 스태프 기기에서 GA를 테스트하려면 이 localStorage 키를 지운다.
 */
export const GA_INTERNAL_FLAG_KEY = "sc_ga_internal";

export const GA_DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

/** 스태프 로그인 이력이 있는 브라우저인지 */
export function isInternalBrowser(): boolean {
  try {
    return localStorage.getItem(GA_INTERNAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** GA 전송 끄기/켜기 (어드민 경로·스태프 브라우저) */
export function setAnalyticsDisabled(disabled: boolean) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  (window as unknown as Record<string, boolean>)[GA_DISABLE_KEY] = disabled;
}

type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params: EventParams = {}) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

/**
 * 로그인 상태가 확정되면 호출. 스태프면 이 브라우저를 표시하고 GA 전송을 즉시 끈다.
 * 그 외에는 user_type 사용자 속성(guest·student)을 설정한다.
 * gtag 로드 전에 호출될 수 있어 dataLayer 큐를 직접 준비한다(초기화 스크립트가 같은 큐를 이어 씀).
 */
export function setAnalyticsUser(role: string | null) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;

  if (isStaffRole(role)) {
    try {
      localStorage.setItem(GA_INTERNAL_FLAG_KEY, "1");
    } catch {
      /* 저장 불가(사파리 개인 모드 등) 시 이번 페이지에서만 끔 */
    }
    setAnalyticsDisabled(true);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js는 arguments 객체 형태의 큐 항목을 기대한다
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }

  window.gtag("set", "user_properties", {
    user_type: role === ROLES.STUDENT ? "student" : "guest",
  });
}

/** 클릭된 링크에서 GA4 이벤트를 판별해 전송 (전화·카카오톡 채널·상담 페이지 링크) */
export function trackLinkClick(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href") ?? "";
  const location =
    anchor.closest("[data-track-location]")?.getAttribute("data-track-location") ??
    window.location.pathname;

  if (href.startsWith("tel:")) {
    trackEvent("contact_click", { method: "phone", location });
    return;
  }
  if (href.includes("pf.kakao.com")) {
    trackEvent("contact_click", { method: "kakao", location });
    return;
  }

  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return;
  }
  if (url.origin === window.location.origin && url.pathname === "/consult") {
    trackEvent("consult_cta_click", { location });
  }
}

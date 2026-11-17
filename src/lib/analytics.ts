/**
 * GA4 이벤트 전송 헬퍼 (클라이언트 전용)
 *
 * - 측정 ID(`NEXT_PUBLIC_GA_MEASUREMENT_ID`)가 없거나 gtag가 아직 없으면 아무것도 하지 않는다.
 *   분석 전송 실패가 화면 동작(폼 제출·이동)을 막지 않게 하기 위함.
 * - 이름·전화번호·학교명·문의 내용 등 개인정보는 절대 params에 넣지 않는다.
 * - 이벤트 설계: Drive `10_projects/studycore-renewal/analytics/ga4-tracking-plan.md`
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params: EventParams = {}) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
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

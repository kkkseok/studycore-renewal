import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getLandingForServe } from "@/domains/landing/service";
import { logger } from "@/lib/logger";

/**
 * 광고 랜딩페이지 동적 서빙 + 리드 게이트웨이 주입
 *
 * 어드민에 등록된 HTML을 원본 그대로 text/html로 응답하되,
 * <head>에 "리드 게이트웨이" 스크립트를 주입한다. 이 스크립트는
 * 업로드된 HTML이 어떤 형태든 다음을 보장한다:
 *
 *  1) 유입 구분: /api/webhook/lead 로 가는 모든 요청에 landing_page_id=slug를
 *     서버 권위로 강제 주입 → consultations.source 가 항상 slug 로 기록됨
 *     (HTML이 보낸 값에 의존하지 않음 → "홈페이지로 잘못 분류" 방지)
 *  2) 표준 폼 연동: 우리 fetch 규약을 쓰지 않는 일반 <form> 제출도 가로채
 *     name/phone 휴리스틱으로 webhook에 JSON POST (외부 빌더 HTML 대응)
 *  3) 누락 방지: 전송 실패 시 localStorage 큐에 보존하고, 재접속/online 시
 *     자동 재전송 (모바일 약전계·탭 종료로 인한 유실 복구)
 *  4) 메타 전환 추적: NEXT_PUBLIC_META_PIXEL_ID가 있으면 Meta Pixel을 초기화
 *     (PageView)하고, 리드 전송 성공 시 fbq('track','Lead')를 발사한다.
 *     서버(/api/webhook/lead)가 응답으로 내려준 eventId를 픽셀 Lead의 eventID로
 *     써서 서버 CAPI 이벤트와 중복 제거한다. URL의 utm_* 파라미터·fbclid도 캡처해 함께 전송.
 *  5) GA4: NEXT_PUBLIC_GA_MEASUREMENT_ID가 있으면 gtag.js를 로드(config가 page_view 전송)하고,
 *     리드 성공 시 generate_lead, 전화·카카오톡 채널 링크 클릭 시 contact_click,
 *     폼에 처음 입력·선택 시 lead_form_start(포커스만으로는 세지 않음), 리드 저장 실패 시
 *     lead_form_fail(server·rate_limit·network)을 보낸다. 업로드 HTML이 자체 입력 검증에 실패하면
 *     window.__lpFormError(칸 이름)를 호출해 lead_form_fail(reason=validation, field)을 남길 수 있다.
 *     호출하지 않는 HTML의 검증 실패(alert 등)는 기록되지 않는다.
 *     이름·전화번호 등 개인정보는 GA4로 보내지 않는다(학년 선택값만).
 *     스태프가 로그인한 브라우저(localStorage sc_ga_internal=1, lib/analytics.ts)는 GA 전송을 끈다.
 *
 * 활성(is_active=true) slug만 서빙, 없으면 404.
 * CSP(script-src/style-src 'unsafe-inline')가 인라인 스크립트를 허용하며,
 * connect.facebook.net(script)·www.facebook.com(img)·GA4 도메인은 next.config.js에 화이트리스트됨.
 *
 * 성능: 같은 slug의 HTML은 방문자와 무관하게 동일하므로(utm/fbclid는 게이트웨이가
 * 클라이언트에서 location.search로 캡처) CDN 엣지 캐싱이 안전하다. 쿠키 의존
 * SSR 클라이언트는 set-cookie를 유발해 CDN 캐싱을 무력화하므로, 공개 읽기 전용
 * anon 클라이언트(쿠키 비의존, RLS landing_public_read)로 조회한다.
 */
/**
 * 랜딩 HTML 조회 결과를 서버 데이터 캐시에 60초 보관한다.
 *
 * Meta 광고 클릭은 매번 다른 fbclid가 URL에 붙어 CDN 캐시가 항상 MISS가 된다.
 * 그때마다 DB에서 HTML(약 200KB)을 다시 읽느라 광고 방문자만 응답이 1.6~3초 걸렸다
 * (2026-11-19 실측: 캐시 HIT 0.15초). URL 쿼리와 무관하게 slug 단위로 데이터를
 * 캐시해 MISS 경로에서도 DB 왕복을 없앤다. DB 오류는 throw되어 캐시되지 않는다.
 * 어드민 수정 반영은 데이터 캐시 60초 + CDN 60초로 최대 약 2분.
 */
const getCachedLanding = unstable_cache(
  async (slug: string) => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    return getLandingForServe(supabase, slug);
  },
  ["landing-serve"],
  { revalidate: 60, tags: ["landing"] }
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let landing;
  try {
    landing = await getCachedLanding(slug);
  } catch (error) {
    logger.exception(error, "landing.serve");
    return new Response("Service Unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (!landing) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const gateway = buildGatewayScript(
    slug,
    process.env.NEXT_PUBLIC_META_PIXEL_ID,
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  );
  const html = landing.html_content.includes("</head>")
    ? landing.html_content.replace("</head>", `${gateway}</head>`)
    : `${gateway}${landing.html_content}`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // CDN 엣지 캐싱: s-maxage 동안 캐시, 만료 후엔 stale-while-revalidate로
      // 캐시를 즉시 응답(방문자 대기 0)하면서 백그라운드로 갱신. 어드민이 HTML을
      // 수정하면 최대 약 2분 내 전파된다(위 데이터 캐시 60초 + CDN 60초).
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
    },
  });
}

/** 업로드 HTML에 주입되는 리드 게이트웨이(인라인 IIFE) */
function buildGatewayScript(slug: string, pixelId?: string, gaId?: string): string {
  const SLUG = JSON.stringify(slug);
  const PIXEL = pixelId ? JSON.stringify(pixelId) : "null";
  const GA = gaId ? JSON.stringify(gaId) : "null";
  // 주의: 이 문자열은 브라우저에서 실행되는 바닐라 JS다. 백틱/한글 따옴표 사용 금지.
  return `<script>(function(){
var SLUG=${SLUG},PIXEL=${PIXEL},GA=${GA},EP="/api/webhook/lead",PV="/api/meta/pageview",QK="lead_queue_v1";
window.__LP_DATA__={clinicId:"studycore_1_0",landingPageId:SLUG};
// Meta Pixel 초기화 (PIXEL 설정 시에만). PageView는 아래에서 event_id와 함께 발사한다.
if(PIXEL){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");window.fbq("init",PIXEL);}
// GA4 (GA 설정 시에만). config가 page_view를 보낸다. 개인정보는 보내지 않는다.
if(GA){window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag("js",new Date());try{if(localStorage.getItem("sc_ga_internal")==="1")window["ga-disable-"+GA]=true}catch(e){}window.gtag("config",GA);var gs=document.createElement("script");gs.async=true;gs.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA);document.head.appendChild(gs);}
function ga(n,p){if(GA&&window.gtag){try{window.gtag("event",n,p)}catch(e){}}}
function leadFail(reason){ga("lead_form_fail",{form_type:"landing",landing_slug:SLUG,reason:reason})}
function gradeOf(p){var g=p&&p.custom_data&&p.custom_data.grade;return(typeof g==="string"&&g.length<=20)?g:undefined}
// URL 추적 파라미터 캡처(도착 시 1회). 픽셀이 fbclid로 _fbc 쿠키를 생성하지만, 어드민 utm 기록을 위해 직접도 보관.
var UP=new URLSearchParams(location.search);function up(k){return UP.get(k)||null}
var TRACK={utm_source:up("utm_source"),utm_medium:up("utm_medium"),utm_campaign:up("utm_campaign"),utm_content:up("utm_content"),utm_term:up("utm_term"),fbclid:up("fbclid")};
function lq(){try{return JSON.parse(localStorage.getItem(QK)||"[]")}catch(e){return[]}}
function sq(q){try{localStorage.setItem(QK,JSON.stringify(q))}catch(e){}}
function enq(p){var q=lq();if(q.length>50)q.shift();q.push({k:Date.now()+"."+Math.random().toString(36).slice(2),p:p});sq(q)}
function deq(k){sq(lq().filter(function(x){return x.k!==k}))}
function fireLead(eid,p){if(window.fbq){try{window.fbq("track","Lead",{},eid?{eventID:eid}:undefined)}catch(e){}}ga("generate_lead",{form_type:"landing",landing_slug:SLUG,grade:gradeOf(p),lead_id:eid||undefined})}
function fireLeadFromResponse(r,p){try{r.clone().json().then(function(d){fireLead(d&&d.eventId,p)}).catch(function(){fireLead(undefined,p)})}catch(e){fireLead(undefined,p)}}
var _f=window.fetch?window.fetch.bind(window):null;
// CAPI PageView 커버리지: 픽셀 PageView를 클라이언트 생성 event_id로 발사하고,
// 같은 id를 서버(/api/meta/pageview)로 보내 중복 제거한다. _fbp 쿠키가 픽셀에 의해
// 설정될 시간을 잠시 기다렸다가 전송(매칭 품질↑), 이탈 시 pagehide로 보장.
if(PIXEL){
  var PVID=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+"."+Math.random().toString(36).slice(2));
  window.fbq("track","PageView",{},{eventID:PVID});
  var pvSent=false;
  function pvSend(){if(pvSent)return;pvSent=true;var b=JSON.stringify({eventId:PVID,eventSourceUrl:location.href});try{if(_f){_f(PV,{method:"POST",headers:{"Content-Type":"application/json"},body:b,keepalive:true}).catch(function(){})}else if(navigator.sendBeacon){navigator.sendBeacon(PV,new Blob([b],{type:"application/json"}))}}catch(e){}}
  var pvTry=0;(function pvWait(){if(document.cookie.indexOf("_fbp=")>=0||pvTry>=10){pvSend();return}pvTry++;setTimeout(pvWait,200)})();
  window.addEventListener("pagehide",pvSend);
}
function isLead(u){return String(u).indexOf(EP)>=0}
// 리드 요청에 landing_page_id/utm/fbclid를 서버 권위로 보강하고, 성공 시 Lead 이벤트를 발사한다.
if(_f){window.fetch=function(u,o){
  if(o&&o.body&&isLead(u)){
    var p=null;try{p=JSON.parse(o.body);p.landing_page_id=SLUG;
      if(p.utm_source==null)p.utm_source=TRACK.utm_source;if(p.utm_medium==null)p.utm_medium=TRACK.utm_medium;if(p.utm_campaign==null)p.utm_campaign=TRACK.utm_campaign;if(p.utm_content==null)p.utm_content=TRACK.utm_content;if(p.utm_term==null)p.utm_term=TRACK.utm_term;
      p.custom_data=p.custom_data||{};if(p.custom_data.fbclid==null)p.custom_data.fbclid=TRACK.fbclid;
      o.body=JSON.stringify(p)}catch(e){}
    return _f(u,o).then(function(r){if(r.ok)fireLeadFromResponse(r,p);else leadFail(r.status===429?"rate_limit":"server");if(!r.ok&&r.status>=500&&p)enq(p);return r}).catch(function(e){leadFail("network");if(p)enq(p);throw e});
  }
  return _f(u,o);
};}
// 재전송(flush)은 원본 fetch로 보내 Lead 중복 발사를 막는다(서버 CAPI가 보완).
function flush(){if(!_f)return;lq().forEach(function(it){_f(EP,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(it.p)}).then(function(r){if(r.ok)deq(it.k)}).catch(function(){})})}
document.addEventListener("submit",function(e){
  if(e.defaultPrevented)return;
  var f=e.target;if(!f||f.tagName!=="FORM")return;
  var fd;try{fd=new FormData(f)}catch(e2){return}
  function pk(){var a=[].slice.call(arguments),it;for(it of fd.entries()){var k=String(it[0]).toLowerCase();for(var i=0;i<a.length;i++){if(k.indexOf(a[i])>=0&&it[1])return it[1]}}return undefined}
  var nm=pk("name","이름"),ph=pk("phone","tel","연락");
  if(!nm||!ph)return;
  e.preventDefault();
  var p={name:nm,phoneNumber:ph,landing_page_id:SLUG,inflowUrl:location.href,utm_source:TRACK.utm_source,utm_medium:TRACK.utm_medium,utm_campaign:TRACK.utm_campaign,utm_content:TRACK.utm_content,utm_term:TRACK.utm_term,custom_data:{school:pk("school","학교"),grade:pk("grade","학년"),marketing_consent:!!pk("marketing","마케팅"),fbclid:TRACK.fbclid}};
  if(!_f){enq(p);alert("\\uc2e0\\uccad\\uc774 \\uc811\\uc218\\ub418\\uc5c8\\uc2b5\\ub2c8\\ub2e4.");return}
  window.fetch(EP,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}).then(function(r){if(r.ok){try{f.style.display="none"}catch(e3){}alert("\\uc2e0\\uccad\\uc774 \\uc811\\uc218\\ub418\\uc5c8\\uc2b5\\ub2c8\\ub2e4.")}else{alert("\\uc7a0\\uc2dc \\ud6c4 \\ub2e4\\uc2dc \\uc2dc\\ub3c4\\ud574 \\uc8fc\\uc138\\uc694.")}}).catch(function(){alert("\\ub124\\ud2b8\\uc6cc\\ud06c \\uc624\\ub958 \\u2014 \\uc7a0\\uc2dc \\ud6c4 \\uc790\\ub3d9 \\uc7ac\\uc804\\uc1a1\\ub429\\ub2c8\\ub2e4.")})
},false);
// GA4 연락 클릭: 전화·카카오톡 채널 링크 (위치는 data-track-location 조상, 없으면 landing)
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";var c=a.closest("[data-track-location]");var l=c?c.getAttribute("data-track-location"):"landing";
  if(h.indexOf("tel:")===0)ga("contact_click",{method:"phone",location:l,landing_slug:SLUG});else if(h.indexOf("pf.kakao.com")>=0)ga("contact_click",{method:"kakao",location:l,landing_slug:SLUG})},true);
// GA4 폼 시작: 폼 안의 입력 요소에 방문자가 처음 입력·선택할 때 1회 (포커스만으로는 세지 않는다 —
// CTA 클릭 후 자동 포커스나 단순 탭이 '입력 시작'으로 부풀려지는 문제 방지, 2026-11-19 변경)
var formStarted=false;
function onFormInput(e){if(formStarted||!e.isTrusted)return;var t=e.target;if(!t||!t.closest||!t.closest("form"))return;var tn=t.tagName;if(tn!=="INPUT"&&tn!=="SELECT"&&tn!=="TEXTAREA")return;formStarted=true;ga("lead_form_start",{form_type:"landing",landing_slug:SLUG})}
document.addEventListener("input",onFormInput,true);
document.addEventListener("change",onFormInput,true);
// 업로드 HTML이 자체 입력 검증에 실패했을 때 호출하는 훅. 칸 이름만 보낸다(입력값은 보내지 않음).
window.__lpFormError=function(field){ga("lead_form_fail",{form_type:"landing",landing_slug:SLUG,reason:"validation",field:String(field||"").slice(0,30)})};
window.addEventListener("online",flush);
if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",flush);else flush();
})();</script>`;
}

# 변경 이력

CLAUDE.md에서 분리한 기능·규칙 변경 이력. 최신 항목이 위.
여기서 도출된 지속 규칙은 CLAUDE.md 본문(코딩 규칙)에 반영한다.

<!-- 형식: YYYY-MM-DD: 변경 내용 (사유) -->
- 2026-11-19: 랜딩 캐시를 `unstable_cache` → 함수 인스턴스 메모리(60초)로 교체, `Server-Timing` 헤더로 적중 여부 표시 (`unstable_cache` 배포 후에도 운영 응답이 1.6초로 그대로 — DB 1회 1.24초, DB 없는 함수 0.27초 실측)
- 2026-11-19: 랜딩 서빙 속도 — `/landing/[slug]`가 HTML을 `unstable_cache`(slug 단위 60초)로 조회, DB 오류는 캐시하지 않고 503. `getLandingForServe`는 오류를 삼키지 않고 throw (광고 클릭마다 fbclid로 CDN MISS가 나 광고 방문자만 응답 1.6~3초 → 클릭 대비 랜딩 조회 43~50% 광고 발생)
- 2026-11-19: 광고 랜딩 폼 개선 — 게이트웨이 `lead_form_start`를 첫 포커스가 아니라 첫 입력·선택(isTrusted) 기준으로 변경, 업로드 HTML용 검증 실패 훅 `window.__lpFormError(field)` 추가(`lead_form_fail` reason=validation). 윈터 랜딩: CTA 후 자동 포커스 제거, 경고창 대신 칸별 오류 표시, 학교 칸 선택 항목으로 변경(개인정보 수집 항목 문구 수정) (CTA 클릭만으로 폼 시작이 집계돼 이탈률이 부풀려졌고, 검증 실패가 기록되지 않았음)
- 2026-11-18: 상담 결과 칸 추가 — `consultations.is_target`·`exclude_reason`(grade·region·no_contact·other)·`enrolled` (마이그레이션 058). 어드민 상담 관리에 '대상 리드'·'등록' 선택 칸, 변경 시 감사 로그 `consultation.outcome_update`. 윈터스쿨 유입 라벨 추가 (광고 성과를 리드 수가 아니라 대상 리드당 비용·등록 기준으로 판단)
- 2026-11-17: GA4 사용자 구분 — 로그인 상태 확정 후 `user_type`(guest·student) 사용자 속성. 스태프가 로그인한 브라우저는 localStorage `sc_ga_internal`로 표시하고 GA 전송을 끔(`ga-disable-<ID>`, 랜딩 포함). `traffic_type=internal`은 gtag가 자동 page_view에 붙이지 않아(실측) 쓰지 않음. 홈 프로그램 상세 모달 열람 `program_view` (재원생·스태프 방문을 신규 방문 분석에서 분리)
- 2026-11-17: GA4 폼 퍼널 이벤트 추가 — `lead_form_start`(첫 입력 포커스, 페이지당 1회), `lead_form_fail`(reason: validation·rate_limit·server·network, 상담 폼은 검증 실패 필드명 포함). 랜딩은 게이트웨이가 처리하며 업로드 HTML 자체 검증 실패는 미기록 (상담 폼 이탈 지점 파악)
- 2026-11-17: GA4(gtag.js 직접, GTM 미사용) 설치 — `GoogleAnalytics.tsx`(루트 레이아웃, `/admin` 제외)·랜딩 게이트웨이 주입, `generate_lead`(상담·랜딩 저장 성공 후)·`contact_click`(전화·카카오)·`consult_cta_click`, CTA 섹션에 `data-track-location`, CSP에 Google 태그 도메인 추가 (윈터 광고 전 유입·전환 측정 시작)
- 2026-11-17: 홈 신뢰 지표(`TrustStrip`) "애플타워 10층 전층" → "애플타워 10층" (사실 정정: 전층이 아니라 10층에 위치). 광고 소재·윈터 랜딩·마케팅 컨텍스트 문서도 동일 정정
- 2026-11-17: 윈터 랜딩 광고별 첫 화면에 `academy`(P6, 학원 병행) 추가 → 시간표 구역(`#sec-routine`)으로 연결 (경쟁 조사: 수완 윈터 광고가 강의형 학원뿐이라 "학원과 병행 가능" 포지션 소재 추가)
- 2026-11-17: 윈터 광고 랜딩에 광고별 첫 화면 맞춤 추가. `utm_content`(Meta `{{ad.name}}`, 예 `W27_P5_pre`) 또는 `?v=`로 히어로 헤드라인·설명을 클릭한 광고 메시지로 바꾸고 관련 구역(`#sec-space`·`#sec-routine`·`#sec-people`·`#sec-report`)을 히어로 바로 아래로 이동(중복 제목·설명 숨김). HTML이 CDN 캐시되므로 방문자 브라우저에서 처리. 광고 관리자 광고 이름이 `ads-copy.csv`의 ad_name과 같아야 동작 (광고와 랜딩 첫 화면의 메시지 불일치로 인한 이탈 방지)
- 2026-11-17: 윈터 광고 랜딩 보강 — 실제 공간 사진 3장·월간 학습 리포트 예시 화면(가상 데이터)을 WebP base64로 인라인(외부 이미지 호스팅 없이 어드민 HTML 업로드만으로 반영), 히어로·폼에 "시작 전 전액 환불"과 4단계 등록 절차 노출 (마케팅 자문단 검토: 신뢰 근거·위험 제거 부족)
- 2026-11-17: 2027 윈터스쿨 Meta 광고용 랜딩 `public/landing/studycore-winter-landing.html` 추가 (어드민 slug `winter-2027`로 업로드). 썸머 랜딩의 폼·약관·리드 전송 구조 재사용, 브랜드 네이비·틸로 교체, 등록비 금액 비노출(사전등록 10% 할인만 표기). `<html>`에 `after-prereg` 클래스를 2026-12-01 00:00 KST 이후 **방문자 브라우저 시각**으로 붙여 `.prereg`/`.postreg` 문구를 전환 — HTML이 CDN 캐시되므로 서버 판정이 아닌 클라이언트 판정 (구글폼 신청은 Meta가 추적 못 해 광고 최적화용 Lead 이벤트가 필요해서)
- 2026-07-23: SEO 개선(감사 기반 Phase 1~3) — (1) 블로그 상세·목록(`/blog`, `/blog/[slug]`)과 후기(`/reviews`)를 Client→Server Component로 SSR 전환. 콘텐츠·H1·`ArticleJsonLd`가 초기 HTML에 없어 크롤 불가하던 문제 해결. 필터·페이지네이션은 URL(`searchParams`) 기반, 권한 의존 버튼만 클라이언트 아일랜드(`BlogWriteButton`/`ReviewWriteButton`)로 분리. (2) 홈 self-referencing canonical을 **`page.tsx` 리프**에 추가 — 루트 `layout.tsx`에 두면 canonical 없는 하위 페이지로 `/`가 상속되어 `/system`·`/notices`가 홈 중복 처리되므로 리프에 배치. (3) `OrganizationJsonLd` 로컬 NAP 완성 — `telephone`·`email`·`streetAddress`·`postalCode`·`openingHoursSpecification`·`sameAs`(카카오·네이버플레이스·인스타) 추가, `@type`에 `LocalBusiness` 병기, `addressLocality`/`addressRegion` 뒤바뀜 수정(`CONTACT` 상수 재사용). 자사 1차 후기는 Google self-serving 정책상 별점 리치결과 대상 아님 → `AggregateRating` 미사용(별점은 GBP/네이버 플레이스로 확보). (4) `/system` sitemap 등록 + self-referencing canonical. (5) 블로그 OG 이미지가 존재하지 않는 컬럼(`status`)으로 조회하던 버그 수정(`is_published`) → 글마다 제목 박힌 브랜드 OG 생성. 코드 외 인프라 작업 남음: Vercel 도메인 non-www 정본 통일(코드는 전부 non-www), `supabase/cleanup_blog_dummy.sql`로 더미 블로그 글 정리
- 2026-06-29: Meta CAPI PageView 커버리지 — 픽셀만 보내던 PageView를 서버 CAPI로도 전송해 "CAPI가 픽셀보다 이벤트 적음" 격차 해소(+중복 제거 키 확보). 픽셀 PageView를 **클라이언트 생성 event_id**로 발사(`fbq('track','PageView',{},{eventID})`)하고 같은 id를 `/api/meta/pageview`(신규)로 보내 서버 PageView 전송→중복 제거. event_id를 클라가 생성하는 이유: 랜딩 HTML이 CDN 캐시되어 서버 주입 시 전 방문자가 같은 id 공유→1건으로 합쳐짐. `_fbp` 쿠키 설정을 짧게 대기 후 전송(매칭 품질↑), 이탈 시 pagehide/keepalive로 보장. 적용: 랜딩 게이트웨이(`/landing/[slug]`) + 홈페이지 `MetaPixel`(init에서 PageView 제거→effect에서 발사). `capi.ts`는 `sendMetaEvent`(범용)로 일반화 + `sendMetaPageViewEvent` 추가(`sendMetaLeadEvent` 하위호환 유지)
- 2026-06-29: 랜딩/상담 속도 개선 — (1) 리드 제출 지연(~10초) 해소: 알림톡/SMS(notify-consult Edge Function)+Meta CAPI를 `after()`(next/server)로 응답 후 백그라운드 실행. `submitConsultation(.., { deferNotify: true })` 옵션 + `notifyConsultationCreated()` 분리, `/api/webhook/lead`·`/api/consult` 적용(응답은 rate-limit+DB저장만 대기). eventId는 응답 전 생성·반환되어 픽셀↔CAPI dedup 영향 없음. (2) `/landing/[slug]` 초기 진입(2~3초) 개선: `Cache-Control`을 `s-maxage=60, stale-while-revalidate=86400`로 CDN 엣지 캐싱 + 쿠키 비의존 anon 클라이언트(`@supabase/supabase-js` createClient)로 전환(set-cookie의 캐싱 무력화 제거, RLS landing_public_read로 익명 읽기). 어드민 HTML 수정은 최대 ~60초 내 전파
- 2026-06-26: 광고 랜딩 메타 전환 추적 — `/landing/[slug]` 게이트웨이에 Meta Pixel(init+PageView, 리드 성공 시 `fbq('track','Lead')`) 주입 + URL `utm_*`·`fbclid` 캡처, `/api/webhook/lead`에 CAPI Lead 전송(`crypto.randomUUID()` eventId를 응답으로 내려 브라우저 픽셀과 공유→중복 제거). 홈페이지 `/consult`(MetaPixel 컴포넌트 + `/api/consult`)와 동일 패턴. `NEXT_PUBLIC_META_PIXEL_ID`·`META_CAPI_ACCESS_TOKEN` 환경변수 필요(미설정 시 graceful skip), CSP·`src/lib/meta/capi.ts`는 기존 자산 재사용
- 2026-06-24: 광고 랜딩페이지 동적 관리 — landing_pages 테이블 + landing 도메인(Space 패턴) + 어드민 CRUD(/admin/landings, HTML 파일 업로드) + `/landing/[slug]` Route Handler 서빙(`__LP_DATA__` 주입으로 slug→consultations.source 연결)
- 2026-06-24: 광고 랜딩 리드 수집 — consultations에 source/utm/marketing_consent 컬럼(마이그레이션 056), /api/webhook/lead 신규(랜딩 payload→submitConsultation 재사용), 어드민 상담관리 유입 컬럼/필터/utm 상세
- 2026-05-04: 재원생 매뉴얼(/manual) 비로그인 공개 — PROTECTED_ROUTES에서 /manual 제거, RLS public_read_manual 정책 추가(type='manual' + is_visible=true), Nav/MobileMenu 비로그인 메뉴에 매뉴얼 링크 추가
- 2026-03-31: 공지사항 공개/회원 공개 구분 — notices.visibility 컬럼(public/members_only), /notices 비로그인 접근 허용, 어드민 다중 선택 일괄 공개 범위 변경, Nav/MobileMenu 비로그인 공지사항 링크 추가
- 2026-03-31: Button 컴포넌트 텍스트 색상 수정 — cn()/twMerge의 text-* 색상·크기 충돌으로 ghost/primary/secondary variant 색상 누락. 내부 클래스 문자열 결합으로 전환 (16곳 자동 수정)
- 2026-03-27: @tailwindcss/typography 플러그인 추가 — prose 클래스 미작동으로 Tiptap HTML 콘텐츠(공지·가이드·블로그)에서 줄바꿈이 표시되지 않던 문제 수정
- 2026-03-25: Footer 하단 여백 — layout.tsx의 div#main-content에 `flex flex-col flex-1` 추가하여 flex 체인 연결
- 2026-03-25: 디자인 토큰 전체 일괄 교체 — text-sm/xs/xl/lg → text-body/caption/fluid-h2/subhead (46개 파일, shadcn·Tiptap prose 제외)
- 2026-03-25: MetaAttachmentList에 onSelect prop 추가 — 이미지 클릭 시 모달 오픈 일관성 확보 (6개 사용처 적용)
- 2026-03-25: 어드민 UX 개선 — /admin/guide 아코디언 목록+분리 편집 페이지, /admin/questions/[id] 질문 접기+답변 아코디언, /admin/notices/new 팝업·알림톡 접기/펼치기
- 2026-03-25: GuideSectionForm 공통 컴포넌트 추출 — 가이드 추가/수정 폼 공유 (RichTextEditor+FileAttachmentManager 통합)
- 2026-03-25: AdminSidebar 메뉴 그룹핑 — 12개 flat list → 5개 그룹(대시보드, 관리, 콘텐츠, 홈페이지, 운영) 구조화
- 2026-03-25: 공간 소개 어드민 동적 관리 — spaces 테이블 + space-images Storage + DDD 3파일(space 도메인) + 어드민 CRUD(/admin/spaces) + SpaceSlider 동적 데이터 전환
- 2026-03-25: E2E 테스트 인프라 구축 — Playwright 4개 프로젝트(public/auth/admin/member), globalSetup 계정 잠금 해제+storageState, 38개 테스트 케이스
- 2026-03-24: 질문/답변 첨부파일 메타데이터 전환 — image_urls TEXT[] → attachments JSONB (원본 파일명 보존), ImageUploader에 onFileUploaded 콜백 추가, MetaAttachmentList로 표시 통일
- 2026-03-24: 첨부파일 다운로드 시 원본 파일명 유지 — downloadWithName blob fetch 방식 도입
- 2026-03-24: 답변 삭제 기능 UI 추가 — 재원생 상세(canAccessAdmin 조건부) + 어드민 상세/스태프 카드(항상 표시)
- 2026-03-24: 첨부파일 컴팩트 UI 통일 — AttachmentList/MetaAttachmentList 공통 컴포넌트 추출, 이미지 64px 썸네일 + 파일 한 줄 리스트 (질문방·공지·프로그램·팝업 전체 적용)
- 2026-03-24: 첨부파일 PDF 지원 + 프로그램 첨부파일 + 팝업 공지 첨부표시 + 감사 이슈 일괄 수정 (외부 브랜드 컬러 토큰화, text-[Npx] 토큰 교체, 접근성 aria-live/aria-label 보강, FAQ 애니메이션 CSS grid-rows 전환)
- 2026-03-24: 매뉴얼/온보딩 Nav 통합 — `/manual` 페이지 내 스태프 전용 탭으로 변경, `/guide`→리다이렉트, Nav에서 온보딩·조교 관리 링크 제거
- 2026-03-23: 전체 권한 검토 — 재원생/스태프 전용 라우트 분리, assistant 권한 제한, 질문 답변/고정 canAccessAdmin 적용
- 2026-03-19: CLAUDE.md 재설계 — 모듈 분리, 검증 루프 추가, 도메인 용어 정의, 중복 제거

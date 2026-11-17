# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!--
이 파일은 점진적으로 개선됩니다.
클로드가 실수하거나 의도와 다른 결과를 낼 때마다,
해당 케이스를 방지하는 규칙을 한 줄씩 추가해 주세요.
예: "API 응답 타입을 변경할 때 프론트엔드 타입도 반드시 함께 수정할 것"
-->
<!-- 팀 공유 학습 시스템 -->
<!-- 이 파일은 Git으로 관리됩니다. 규칙 추가/수정 시 PR을 통해 팀원 리뷰를 받아주세요. -->

# StudyCore Web

## 개요
관리형 학습공간 홈페이지. 공개 랜딩 + 재원생 서비스(공지·질문방·도시락) + 어드민 패널.

## 기술 스택
Next.js 16 (App Router, TS strict, webpack 빌드) · Tailwind v4 + @tailwindcss/typography + shadcn/ui · Supabase (PG + Auth + Storage + Edge Functions) · Zustand (sessionStorage persist) · react-hook-form + zod v4 · Tiptap · Framer Motion · @dnd-kit(정렬) · xlsx(엑셀) · isomorphic-dompurify(sanitize) · next-pwa · Playwright E2E · Vercel 배포. Path alias: `@/*` → `./src/*`

## 빌드 & 실행
```bash
npm install            # 의존성 설치
npm run dev            # localhost:3000 (webpack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npx tsc --noEmit       # 타입 체크
npx playwright test              # E2E 전체 실행 (dev 서버 실행 필수)
npx playwright test --ui         # UI 디버깅 모드 (= npm run test:e2e:ui)
npx playwright test --project=public   # 공개 페이지만
npx playwright test --project=auth     # 인증/권한만
npx playwright test --project=admin    # 어드민만
npx playwright test --project=member   # 재원생만
npx playwright test e2e/tests/public/home.spec.ts   # 파일 하나만
npx playwright test -g "<테스트명>"                  # 이름으로 하나만
```
단위 테스트(Jest/Vitest)는 없다. 자동 테스트는 Playwright E2E뿐.

## 디렉터리 구조
```
src/app/               대부분의 페이지가 최상위에 직접 위치: blog, consult, notices, manual, questions,
                       guide, my, system, login, auth, privacy, terms, pending-approval, account-inactive
src/app/(public)/      about, reviews (목록)
src/app/(member)/      meal, reviews/write
src/app/admin/         어드민 (admin/mentor 권한, /admin/guide만 assistant 허용)
src/app/landing/[slug]/ 광고 랜딩 HTML 게이트웨이 (Route Handler, landing_pages 테이블)
src/app/api/           Route Handlers: auth/staff-login, admin/create-staff, consult, notify,
                       webhook/lead (랜딩 리드), meta/pageview (CAPI PageView)
src/domains/           DDD 3파일 패턴 — 상세: src/domains/CLAUDE.md
src/components/        UI 컴포넌트 — 브랜드/패턴: src/components/CLAUDE.md
src/lib/supabase/      Supabase 클라이언트 (server.ts, client.ts)
src/lib/               audit.ts(감사 로그) · rate-limit.ts · sanitize.ts · logger.ts · meta/capi.ts ·
                       staff-auth-config.ts(서버 전용) · constants.ts(ROUTES·권한 라우트 목록)
src/stores/ src/hooks/ Zustand 스토어 / 커스텀 훅
supabase/migrations/   스키마 변경 SQL (번호 순) · supabase/functions/: 알림 Edge Function
e2e/                   E2E 테스트 (Playwright) — helpers, fixtures, tests/{public,auth,admin,member}
```
`(public)`/`(member)` 라우트 그룹은 일부 페이지만 묶는다. 접근 제어는 그룹이 아니라 middleware가 결정한다.

## 환경변수
값은 `.env.local`(로컬)과 Vercel 환경변수에 있다. 이름만 기록한다.

| 구분 | 이름 | 없으면 |
|------|------|--------|
| 필수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` | 앱 동작 불가 |
| 필수 | `STAFF_AUTH_FIXED_PASSWORD` | `staff-auth-config.ts`가 throw → 스태프 로그인·스태프 생성 API 실패 (fallback 없음) |
| 선택 | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE` | Meta 픽셀·CAPI 전송 skip |
| 선택 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 미로드 (`GoogleAnalytics.tsx`, 랜딩 게이트웨이). `/admin`에서는 항상 미로드 |
| 선택 | `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | 소개 페이지 카카오 지도(`LocationSection`) 미표시 |
| 미사용 | `REVALIDATE_SECRET` | `.env.example`·`.env.local`에 있으나 현재 코드에서 참조 없음 |
| E2E | `.env.test`의 `TEST_{ADMIN,MENTOR,ASSISTANT}_{USERNAME,PASSWORD}` | 인증 E2E 실패 |
| Edge Function (Supabase secrets, `.env.local` 아님) | `ADMIN_PHONE`, `KAKAO_CHANNEL_ID`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_PHONE` | 알림톡/SMS 발송용 |

환경변수를 추가하면 `.env.example`에도 이름을 추가한다.

## 도메인 용어
| 용어 | 의미 | 혼동 주의 |
|------|------|----------|
| Consultation (상담 신청) | 외부 방문자의 입소/견학 문의. status: `new→contacted→done` | Counseling과 **별개** 도메인 |
| Counseling (상담 기록) | 스태프↔재원생 상담 내역 기록. types: admission/career/etc | Consultation과 혼동 금지 |
| 재원생 (student) | 등록된 학생. 계정 상태: `pending→active→inactive` | User(시스템 사용자)와 구분 |
| 스태프 | admin · mentor · assistant 통칭. `isStaffRole()`로 판별 | |
| Notice | 공지사항. visibility: `public`(전체 공개) vs `members_only`(회원 공개) | 비로그인은 public만 조회 |
| MealPeriod | 도시락 신청 기간. selection: `weekday`(요일) vs `date`(날짜) | |
| Question | 재원생 Q&A. status: `pending→answered` | |

## 코딩 규칙

### 절대 금지 — 위반 발견 시 즉시 수정
1. `rounded-*` 클래스 → border-radius 항상 0 (globals.css override)
2. `shadow-*` 클래스 → box-shadow 불가
3. `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 노출
4. Next.js Route에서 알림톡/SMS 직접 호출 → Supabase Edge Function 경유 필수
5. 컴포넌트에서 직접 DB 쿼리 → `src/domains/[도메인]/repository.ts` 경유 필수
6. 로그아웃 시 `router.push()` → `window.location.href = "/"` 사용 (전체 리로드)
7. `SIGNED_OUT`에서 `setUser`/`setProfile` 개별 호출 → `logout()` 한 번 호출
8. 도메인 repository→repository 직접 호출 → service→service만 허용
9. `cn()`/`twMerge`에 커스텀 `text-*` 색상과 `text-*` 폰트 크기를 함께 전달 → twMerge가 동일 그룹으로 인식하여 하나를 삭제함. Button 컴포넌트처럼 내부 클래스는 문자열 결합 사용

### 필수 패턴
- 모든 폼: react-hook-form + zod
- Server Component / Route Handler → `createClient()` (lib/supabase/server.ts)
- Client Component → `createClient()` 또는 별칭 `createBrowserClient()` (lib/supabase/client.ts)
- RLS 우회 → `createAdminClient()` (lib/supabase/server.ts)
- 공개 색인 페이지(블로그·후기 등 목록/상세) → Server Component로 SSR. 콘텐츠를 `useEffect` 클라이언트 페치로만 렌더 금지(크롤러가 빈 HTML 수신). 인터랙션은 하위 클라이언트 아일랜드로 분리, 필터·페이지네이션은 URL `searchParams` 기반
- 권한 검사 → middleware.ts
- 클릭 가능 요소 → `cursor-pointer` 필수
- hover 상태 → `transition-colors duration-200` 이상
- 폰트 사이즈 → `text-label`~`text-subhead` / `text-fluid-*` 토큰 사용 (`text-[Npx]` 금지)
- 섹션 패딩 → `section-sm`/`section-md`/`section-lg` 사용
- 페이지 본문 → `page-body` 사용 (`pt-24 pb-20` 금지)
- 컨테이너 너비 → Tailwind `max-w-md`/`max-w-3xl`/`max-w-4xl`/`max-w-6xl` + `mx-auto` 사용
- line-height → `leading-heading`/`leading-ui`/`leading-prose` 사용 (`leading-[N]` 금지)
- letter-spacing → `tracking-heading`/`tracking-cta`/`tracking-label` 사용 (`tracking-[Nem]` 금지)

### 서버 유틸 (src/lib)
- **Rate limit**: 외부 입력을 받는 민감 API(`consult`, `webhook/lead`, `admin/create-staff`)는 `checkRateLimitDB()`(rate_limits 테이블, 인스턴스 간 공유). 인메모리 `checkRateLimit()`은 serverless 인스턴스별로 갈라져 부정확하므로 가벼운 스팸 방지에만
- **감사 로그**: 어드민의 데이터 변경(사용자 상태·역할, 공지, 질문 답변, 블로그, 설정)은 해당 domain `service.ts`에서 `lib/audit.ts`의 `log*()`/`createAuditLog()` 호출. 새 어드민 변경 액션도 동일하게 추가
- **HTML 렌더링**: DB에서 온 HTML(Tiptap 콘텐츠 등)을 `dangerouslySetInnerHTML`로 넣을 때는 반드시 `sanitizeHtml()` 경유. 코드에 하드코딩된 정적 문자열(JsonLd 등)은 예외
- **로깅**: 새 코드는 `lib/logger.ts`의 `logger` 사용 (프로덕션에서 debug/info 제외). 기존 `console.*` 사용처는 아직 미전환
- **`staff-auth-config.ts`**: 서버 전용. Client Component에서 import 금지

### CSP (next.config.js — 정식 차단 모드)
`Content-Security-Policy`가 Report-Only가 아니라 **실제 차단**한다. 새 외부 스크립트·이미지·API·iframe 도메인을 쓰면 `buildContentSecurityPolicy()`의 해당 directive(`script-src`/`img-src`/`connect-src`/`frame-src`)에 추가해야 한다. 누락 시 브라우저가 조용히 차단한다(콘솔에 CSP 위반만 표시). dev와 prod의 차이는 `script-src`의 `'unsafe-eval'`(dev만 허용)뿐이다. Supabase Storage 이미지를 `next/image`로 쓰면 `images.remotePatterns`도 확인.

### SEO · 광고 추적 · 성능
- canonical은 각 리프 `page.tsx`의 `metadata.alternates.canonical`에 둔다. 루트 `layout.tsx`에 두면 canonical 없는 하위 페이지가 `/`를 상속해 홈 중복으로 처리됨
- 공개 페이지 추가 시 `src/app/sitemap.ts`에 등록
- 상담·리드 API에서 알림톡/SMS·Meta CAPI 전송은 `after()`(next/server)로 응답 후 실행 (`submitConsultation(.., { deferNotify: true })` + `notifyConsultationCreated()`). 응답이 기다리는 것은 rate limit + DB 저장뿐
- GA4 이벤트는 `lib/analytics.ts`의 `trackEvent()`로 보낸다. 리드는 저장 성공 응답 후 `generate_lead`(Meta Lead 발사 위치와 같은 곳). 전화·카카오톡·상담 링크 클릭은 `GoogleAnalytics.tsx`의 위임 리스너가 가장 가까운 `data-track-location` 조상 값으로 기록하므로, 새 CTA 섹션에는 이 속성을 단다. 이름·전화번호·학교명·문의 내용은 GA4로 보내지 않는다. 스태프가 로그인한 브라우저는 localStorage `sc_ga_internal`로 GA 전송을 끈다(`traffic_type=internal`은 자동 page_view에 안 붙어 쓰지 않음). 이벤트 설계는 Drive `10_projects/studycore-renewal/analytics/ga4-tracking-plan.md`
- Meta 픽셀↔CAPI 중복 제거용 id: **PageView**는 클라이언트가 `crypto.randomUUID()`로 생성해 픽셀 발사 + `/api/meta/pageview`로 전달 (랜딩 HTML이 CDN 캐시되므로 서버 주입 시 전 방문자가 같은 id를 공유하게 됨). **Lead**는 서버(`/api/consult`·`/api/webhook/lead`)가 생성해 응답으로 내려준 eventId를 픽셀이 재사용
- `/landing/[slug]`는 `s-maxage=60, stale-while-revalidate` CDN 캐싱. 쿠키를 쓰는 서버 클라이언트 대신 쿠키 비의존 anon 클라이언트(`@supabase/supabase-js`)를 써야 캐싱이 유지됨 (RLS `landing_public_read`). 어드민 수정은 최대 ~60초 후 반영
- 랜딩 리드의 유입 구분: 게이트웨이가 업로드된 HTML에 스크립트(`__LP_DATA__`)를 주입하고, 이 스크립트가 `/api/webhook/lead` 요청 body의 `landing_page_id`를 slug로 덮어씀 → `consultations.source`에 slug 기록 (기본 상담폼은 `homepage`). 업로드 HTML 자체는 slug를 몰라도 됨

### 인증
- 재원생: 카카오 OAuth → `/auth/callback` → `/register`
- 스태프: username → 이메일(`@studycore.internal`) 조회 → `signInWithPassword` → `verify_staff_password` RPC
- 잠금: 5회 실패 → 15분 (`login_attempts`)
- 로그아웃: `signOut()` → `logout()` → `window.location.href = "/"`

### 권한
| 역할 | 접근 | 체크 함수 | 비고 |
|------|------|----------|------|
| student | 공개 + 재원생 페이지 | `isStudent()` | status=active 필수 |
| assistant | + /admin/guide 만 | `isStaffRole()` | 사이드바에 "조교 온보딩"만 표시 |
| mentor | + /admin/* 전체 | `hasAdminAccess()` | admin과 동일 권한 |
| admin | /admin/* 전체 | `hasAdminAccess()` | mentor와 동일 권한 |

**권한 레이어 (3단계)**:
1. **middleware.ts** — 서버 사이드 라우트 보호 (SSoT)
   - `PROTECTED_ROUTES`: 로그인 필수 (`/guide`, `/questions`, `/meal`, `/my`, `/reviews/write`)
   - `/notices`는 비로그인 접근 허용 (visibility='public' 게시글만 표시)
   - `/manual`은 비로그인 접근 허용 (type='manual' + is_visible=true 섹션만 표시, 스태프는 ?tab=onboarding 추가 노출)
   - `ADMIN_ROUTES`: admin/mentor 필수 (`/admin`)
   - `ASSISTANT_ROUTES`: staff 필수 (`/admin/guide`)
   - 위 3개 목록은 `src/lib/constants.ts`에 있지만, 아래 재원생/스태프 전용 라우트는 `middleware.ts` 안에 하드코딩되어 있다
   - 재원생 전용 라우트: `/meal`, `/reviews/write`, `/questions/new` — 스태프 접근 차단 (admin/mentor→`/admin`, assistant→홈)
   - 스태프 전용 라우트: `/guide` — 학생 접근 차단 (스태프는 `/manual?tab=onboarding`으로 리다이렉트)
   - `/manual` 페이지에서 스태프 전용 온보딩 탭 제공 (`?tab=onboarding`), 학생에게는 탭 미노출
   - **스태프 비밀번호 강제 변경**: `profiles.must_change_password=true`인 스태프는 보호 라우트 접근 시 `/my?force_password_change=1`로 강제 이동 (그 URL만 허용). 변경 완료 시 query 자동 제거
   - student status 체크: pending→`/pending-approval`, inactive→`/account-inactive` (두 안내 페이지도 middleware가 실제 status와 일치할 때만 표시)
   - student 연락처(`phone`) 미입력 시 `/my` 외 보호 라우트 → `/my`로 이동
   - 위 검사는 보호 라우트(`PROTECTED_ROUTES`·`ADMIN_ROUTES`) 진입 시에만 수행된다. 공개 페이지에서는 프로필을 조회하지 않음 (예외: 두 상태 안내 페이지는 status만 조회)
2. **admin/layout.tsx** — 클라이언트 사이드 이중 체크
   - `/admin/guide`: `isStaff` 체크 (assistant 허용)
   - 그 외 `/admin/*`: `canAccessAdmin` 체크 (admin+mentor만)
3. **AdminSidebar.tsx** — 역할별 메뉴 필터링
   - assistant: `assistantVisible: true`인 메뉴만 표시
   - admin/mentor: 전체 메뉴 표시

**질문 관리 권한**: 질문 답변/고정/답변 삭제는 `canAccessAdmin`(admin+mentor)만 가능. assistant는 불가. 마지막 답변 삭제 시 질문 상태가 `pending`으로 자동 복원.

### 상태 관리
- `useUserStore` (Zustand + sessionStorage persist). `isLoading`은 persist 제외
- `AuthInitializer`: 검증만 수행. persist↔Supabase 불일치 시만 DB 재조회

### 알림 흐름 (모두 Edge Function 경유)
클라이언트는 식별자(questionId/noticeId)만 `/api/notify`에 전송 → 서버가 권한 검사·수신자·본문을 DB로 재계산 후 Edge Function 호출 (상담 신청만 `/api/consult` 경유). 클라이언트에서 메시지 본문·수신자 직접 전송 금지.
```
상담 신청 → /api/consult → notify-consult     → 관리자 알림톡 + 신청자 SMS
재원생 질문 → /api/notify → notify-question   → 멘토 알림톡
멘토 답변 → /api/notify → notify-answer       → 재원생 알림톡 (active만)
공지 발행 → /api/notify → send-kakao-alimtalk → 재원생/학부모
```

## 코드 리뷰 (구현 직후)

코드를 구현하거나 수정하면, 결과를 보고하기 전에 수정한 파일을 다시 읽고 아래 A~C를 점검한다. 리뷰를 거치지 않은 작업은 완료로 보고하지 않는다.

### 프로세스
1. 코드 구현/수정 완료
2. 수정한 모든 파일을 다시 읽고 아래 체크 항목 전체 점검
3. 고칠 것이 있으면 반영하고, 반영한 부분을 다시 점검
4. 리뷰 종료 → 사용자에게 결과 보고
5. (커밋은 사용자 요청 시에만)

### A. 요구사항 충족 검증 (가장 먼저 수행)
- 사용자의 요청사항을 하나씩 나열하고, 각각 반영 여부를 대조
- 이번 작업으로 이전에 완료한 변경이 되돌려지거나 누락되지 않았는지 확인
- 여러 파일에 걸친 작업일 경우, 모든 파일에서 요구사항이 일관되게 적용됐는지 확인

### B. 프로젝트 전체 영향도 검증
- 공통 컴포넌트·유틸·타입을 수정했다면, 해당 모듈을 import하는 **모든 사용처**를 Grep으로 찾아 호환성 확인
- props 변경·삭제 시 사용처에서 빌드 에러나 런타임 오류가 없는지 확인
- 도메인 서비스/repository 수정 시 해당 도메인을 호출하는 페이지·컴포넌트의 동작 맥락이 어긋나지 않는지 확인
- 스타일 변경 시 동일 클래스를 공유하는 다른 화면에 의도치 않은 영향이 없는지 확인

### C. 코드 품질 체크
- 미사용 import / 변수
- import 순서 (외부 라이브러리 → 내부 모듈 → 상대경로)
- 모바일 레이아웃 깨짐 (padding/margin 변경 시)
- 레이아웃 시프트 (hover 시 크기 변경)
- 애니메이션 상태 관리 (`undefined` target, 순환 로직)
- CLAUDE.md 프로젝트 규칙 위반 (rounded, shadow, 서버/클라이언트 컴포넌트, DDD 패턴 등)
- 변경 대상과 동일 패턴이 다른 파일에도 있는지 (누락 방지)
- 기존 코드와의 일관성

## 검증 규칙 (Self-Verification)
코드 변경 후 아래를 순서대로 수행한다. 단계에서 에러가 나면 고치고 그 단계를 다시 실행해 0개를 확인한 뒤 다음 단계로 간다.

| 단계 | 명령어 | 실패 시 대응 |
|------|--------|-------------|
| 1. 타입 체크 | `npx tsc --noEmit` | 에러 파일:줄 확인 → 수정 → 재실행 |
| 2. 빌드 | `npm run build` | 에러 메시지의 파일:줄 확인 → 수정 → 재실행 |
| 3. 린트 | `npm run lint` | `--fix`로 자동 수정 가능한 것 먼저 처리, 나머지 수동 수정 → 재실행 |
| 4. UI 확인 | `npm run dev` | 변경한 페이지 경로 + 확인할 동작을 체크리스트로 제시 (아래 예시) |

**UI 변경 시**: `brand-design-system` 스킬과 `src/components/CLAUDE.md` 기준으로 디자인을 검토한다.

**UI 확인 체크리스트 예시** (UI 변경 시 반드시 이 형식으로 제시):
```
확인 페이지: http://localhost:3000/admin/meal
- [ ] 테이블 렌더링 정상
- [ ] 필터 클릭 시 데이터 갱신
- [ ] 모바일 뷰포트(375px)에서 레이아웃 깨짐 없음
```

추가 규칙:
- Supabase 스키마 변경 시 `supabase/migrations/`에 SQL 파일 추가
- 새 도메인 추가 시 `src/domains/CLAUDE.md`의 도메인 테이블도 업데이트
- 에러를 사용자에게 보고만 하지 말 것. 원인 분석 → 수정 → 재검증까지 완료

## Phase 진행 규칙
새 Phase → `dev/active/phase{N}-{name}/` 에 3개 파일 생성:
```
phase{N}-{name}-context.md  ← 결정 이력, 제약 사항
phase{N}-{name}-plan.md     ← 설계, 기술 결정
phase{N}-{name}-tasks.md    ← 작업 목록, 완료 기록
```

## 참조 문서
- `dev/active/PROJECT-STATUS.md` — 프로젝트 진행 현황
- `docs/plans/` — Phase별 계획 문서
- `.claude/skills/brand-design-system/SKILL.md` — 브랜드 디자인 규칙 스킬
- `src/components/CLAUDE.md` — UI/브랜드 패턴 (컬러, 타이포, 모달, CTA)
- `src/domains/CLAUDE.md` — DDD 3파일 패턴 + 도메인 목록
- `src/app/admin/CLAUDE.md` — 어드민 전용 규칙

## 유지보수
- **기능 추가/변경 후**: "CLAUDE.md에 이번 변경사항 반영할 게 있는지 확인해줘"
- **월 1회 정기 점검**: "CLAUDE.md 전체를 리뷰해줘. 코드베이스와 맞지 않는 규칙, 빠진 규칙, 중복 찾아줘"
- **같은 실수 2회 반복 시**: 해당 실수를 방지하는 규칙을 즉시 추가

## E2E 테스트

### 구조
```
e2e/
  fixtures/       auth.fixture.ts, test-data.fixture.ts
  helpers/        login.helper.ts, navigation.helper.ts, supabase.helper.ts
  global-setup.ts    계정 잠금 해제 → storageState 저장 (admin/mentor/assistant)
  global-teardown.ts 테스트 데이터 정리
  tests/
    public/       홈, 네비게이션, 상담 신청 (인증 불필요)
    auth/         스태프 로그인, 라우트 보호, 역할별 권한
    admin/        대시보드, 공지 CRUD, 질문 관리 (admin storageState)
    member/       공지, 질문, 마이페이지 (mentor storageState)
```

### 환경 설정
- `.env.local`: Supabase URL/Key (dev 서버용)
- `.env.test`: 테스트 계정 (TEST_ADMIN_*, TEST_MENTOR_*, TEST_ASSISTANT_*)
- `#` 포함 비밀번호는 `.env.test`에서 반드시 따옴표로 감싸기
- `e2e/.auth/`: storageState 파일 (gitignore됨, globalSetup에서 자동 생성)

### 실행 주의
- **dev 서버 먼저 실행** (`npm run dev`) → `npx playwright test`
- globalSetup에서 `unlock_account` RPC로 잠금 해제 후 로그인 (5회 실패 잠금 방지)
- CI에서는 webServer가 자동으로 빌드+서버 시작

## 변경 이력
`docs/CHANGELOG.md`에 기록한다 (형식: `- YYYY-MM-DD: 변경 내용 (사유)`, 최신이 위). 이력에서 나온 지속 규칙은 이 파일 본문에 반영한다.

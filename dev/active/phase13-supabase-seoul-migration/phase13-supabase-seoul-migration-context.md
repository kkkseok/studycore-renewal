# Phase 13: Supabase 서울 리전 이전 — Context

작성: 2026-11-23 · 상태: 계획 (실행 전, 사용자 승인 대기)

## 배경

2026-11-22 Supabase에서 "Disk IO Budget 소진 중" 경고 메일 수신. 조사 결과:

- 원인은 쿼리가 아니라 **메모리 부족 → 스왑**. 컴퓨트가 Nano(RAM 411MB)인데 스왑 485MB 사용, Memory commitment 1.59GB(대시보드 SEVERE).
- DB 자체는 매우 작고 건강함: 23MB, 캐시 적중률 100%, 253일간 WAL 544MB.
- 최근 7일 Disk IO balance 일별 최저값 51% (11/16). 0%까지 간 날은 없음 → 아직 실제 스로틀링은 없음.
- 프로젝트 리전이 **뭄바이(ap-south-1)**, Vercel 함수는 **미국 동부(iad1)** 에서 실행 중 (`X-Vercel-Id: icn1::iad1::...`). 한국 사용자 요청이 서울 엣지 → 미국 함수 → 뭄바이 DB를 왕복함.

## 결정 이력

| 날짜 | 결정 | 근거 |
|------|------|------|
| 2026-11-23 | Nano → Micro 상향 대신 **서울 리전 새 프로젝트로 이전** | Pro 조직의 새 프로젝트는 기본 Micro라 메모리 문제도 함께 해결. 리전 지연도 해소 |
| 2026-11-23 | 같은 조직(`kkkseok`)에 새 프로젝트 생성 | 조직 멤버가 본인 계정 1명(Owner)뿐임을 확인. 전 회사 소유 아님 |
| 2026-11-23 | Vercel 함수 리전을 `icn1`로 **DB 전환과 같은 배포에서** 변경 | DB만 옮기면 미국↔서울 왕복이 남아 이득 없음. 함수만 먼저 옮긴 경우는 측정하지 않아 효과 불명 |
| 2026-11-23 | 마이그레이션 SQL 재실행이 아니라 **운영 DB 덤프 → 복원** | 운영 DB와 `supabase/migrations/`가 어긋나 있음 (아래 "발견 사항" 1) |
| 2026-11-23 | 기존 프로젝트는 전환 후 **1~2주 관찰 뒤 삭제** | 환경변수만 되돌리면 즉시 롤백 가능한 상태를 유지 |
| 2026-11-23 | Postgres 17 클라이언트 설치 승인·완료 | 사용자 승인 |
| (미결) | 기존 프로젝트를 먼저 Micro로 무료 상향할지 | 준비 단계에서 Nano→Micro가 추가 비용 없음을 확인. 상향하면 이전의 긴급성이 사라져 광고 성수기 이후로 미룰 수 있음 |

## 현재 상태 (2026-11-22~23 실측)

| 항목 | 값 |
|------|-----|
| 기존 프로젝트 | `studycore-renewal` (ref `wshmxjctdwhasxhjxlxm`), ap-south-1, Nano, Postgres 17.6 |
| 조직 | `kkkseok`, Pro 플랜, 프로젝트 3개, 멤버 1명 |
| DB | 23MB. public 테이블 29개, RLS 정책 95개, 함수 31개, 시퀀스 0개, 커스텀 role 없음 |
| 확장 | `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault` (vault secret 0건) |
| Auth | 사용자 33명 (identity: kakao 28, email 5). `auth.users` 트리거 `on_auth_user_created` |
| Storage | 164개 / 69MB, 공개 버킷 9개, storage 정책 32개 |
| Realtime | publication 테이블 0개 (미사용) |
| Edge Function | `notify-answer`, `notify-consult`, `notify-question`, `send-kakao-alimtalk` + `_shared` |
| Edge Function 시크릿 (이름) | `ADMIN_PHONE`, `KAKAO_CHANNEL_ID`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_PHONE` |

### 기존 프로젝트 주소가 본문에 들어 있는 행 (새 주소로 치환 대상)

| 테이블 | 해당 행 / 전체 |
|--------|---------------|
| `public.question_answers` | 27 / 31 |
| `public.questions` | 26 / 26 |
| `public.notices` | 13 / 33 |
| `public.spaces` | 10 / 10 |
| `public.guide_sections` | 2 / 20 |

`public`·`auth` 전 테이블을 스캔한 결과이며 그 외 테이블은 0건.

## 이 Supabase 프로젝트에 의존하는 것 (전환 시 모두 바꿔야 함)

1. **studycore-renewal (Vercel)** — 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. 코드에는 프로젝트 주소가 없음 (`next.config.js`의 CSP·`images.remotePatterns`는 `*.supabase.co` 와일드카드).
2. **studycore-dashboard (report.studycore.kr)** — `web/config.js`에 프로젝트 URL이 하드코딩됨. `rpt_students`·`rpt_corrections`·`rpt_meta`·`rpt_admins` 테이블과 `rpt_get_report` RPC 사용. **별도 저장소라 따로 수정·배포 필요.**
3. **Edge Function 4개** — 새 프로젝트에 재배포 + 시크릿 5개 재등록.
4. **카카오 개발자 콘솔** — OAuth Redirect URI에 새 프로젝트 콜백 주소 추가.
5. **Supabase Auth 설정** — Site URL, Redirect URL 목록, 카카오 provider 키, 기타 Auth 옵션. 덤프에 포함되지 않아 수동 이전.
6. **로컬·테스트** — `.env.local`, E2E(`e2e/helpers/supabase.helper.ts`가 같은 환경변수 사용).
7. **Claude 연결** — Supabase MCP 커넥터(`Supabase-StudyCore`)가 기존 프로젝트를 가리킴. 광고 분석 클라우드 루틴 2개(주간 v2, 매일 점검)가 이 커넥터로 `consultations`를 집계함.

## 발견 사항

1. **`054_add_cleanup_crons.sql`이 운영에 반영돼 있지 않음** — 운영 DB에 `pg_cron` 확장이 없음(`cron.job` 없음). `rate_limits`·`audit_logs` 정기 정리 크론이 돌지 않는 상태. 새 프로젝트에서 켤지 결정 필요 (plan "미결 사항").
2. **`NEXT_PUBLIC_SUPABASE_URL`은 클라이언트 번들에 박힘** — 전환 시점에 열려 있던 탭·PWA 캐시는 재로드 전까지 기존 프로젝트로 직접 쓴다 (질문·도시락 신청 등 로그인 사용자의 클라이언트 직접 쓰기). 상담 신청·랜딩 리드는 서버(`/api/consult`, `/api/webhook/lead`) 경유라 해당 없음.
3. **로컬에 도구 없음** — `supabase` CLI, `pg_dump`, `docker` 모두 미설치. Postgres 17 클라이언트 설치 필요.
4. **이전 Vercel 계정(kkkseok 범위)에 남은 service role 키** — 기존 Supabase 프로젝트를 삭제하면 무효가 되어 별도 재발급이 필요 없어짐.

## 준비 단계 확인 결과 (2026-11-23)

### 요금

- 대시보드 컴퓨트 요금표: **Nano $0.01344/시간, Micro $0.01344/시간 (Nano에 "Free Upgrade" 표시)**. 유료 조직에서는 Nano도 Micro 요금으로 청구되고 있다. 이번 청구 주기 사용 내역에도 "Micro Compute Hours"로만 잡힘.
- 따라서 **기존 프로젝트를 Micro로 올리는 데 추가 비용이 없다.** 재시작만 필요. Disk IO 경고는 이전과 무관하게 지금 바로 해소할 수 있다.
- 새 프로젝트를 추가하면 겹치는 기간 동안 시간당 $0.01344가 더 붙는다 (하루 약 $0.32, 2주 약 $4.5 — 요금표 단가로 계산한 값). 기존 프로젝트를 삭제하면 원래 수준으로 돌아온다.
- 조직의 프로젝트 3개: `studycore-renewal`, `jkm-dashboard`, `lowest-price-monitor`. 컴퓨트 크레딧 $10은 조직 전체에 1회 적용.

### 기존 Auth 설정 (새 프로젝트에 동일하게 입력)

| 항목 | 값 |
|------|-----|
| Site URL | `https://studycore.kr` |
| Redirect URLs (3개) | `https://studycore.kr/auth/callback`, `http://localhost:3000/auth/callback`, `https://www.studycore.kr/auth/callback` |
| Allow new users to sign up | 켜짐 |
| Allow manual linking | 꺼짐 |
| Allow anonymous sign-ins | 꺼짐 |
| Confirm email | 켜짐 |
| 사용 중인 provider | Email, Kakao (나머지 전부 꺼짐) |
| 세션 | 단일 세션 강제 꺼짐, time-box 0(never), inactivity timeout 0(never) |
| Access token 만료 | 3600초 |
| Rate limit | 토큰 갱신 150/5분, 토큰 검증 30/5분, 가입·로그인 30/5분 (기본값으로 보임) |
| Captcha | 꺼짐 |
| Leaked password 보호 | 꺼짐 |
| Auth Hooks | 없음 |

기록하지 않은 것: Kakao provider 내부 값(Client ID/Secret, 동의 항목 옵션), 이메일 템플릿·SMTP, Refresh token 재사용 간격, MFA 설정. Kakao 값은 사용자가 직접 옮긴다.

### Storage 버킷 설정 (전부 공개)

| 버킷 | 크기 제한 | 허용 MIME | 객체 |
|------|----------|-----------|------|
| `blog-thumbnails` | 2MB | jpeg, png, webp | 0 |
| `editor-images` | 10MB | 제한 없음 | 39 / 30MB |
| `guide-attachments` | 20MB | 이미지 4종, pdf, MS Office 6종, zip, txt | 0 |
| `notice-attachments` | 10MB | 제한 없음 | 4 / 990KB |
| `popups` | 5MB | 제한 없음 | 0 |
| `program-attachments` | 10MB | 제한 없음 | 0 |
| `programs` | 5MB | 제한 없음 | 0 |
| `question-images` | 10MB | jpeg, png, webp, gif, pdf | 89 / 28MB |
| `space-images` | 5MB | jpeg, png, webp | 32 / 11MB |

### 도구

- `pg_dump`·`psql` 17.12 설치 완료 (`C:\Program Files\PostgreSQL\17\bin`, 명령줄 도구만. PATH에는 없으므로 전체 경로로 실행).
- 이 PC에는 `postgresql-x64-18` 서비스가 이미 실행 중이었다 (이번 설치와 무관한 기존 설치).
- Supabase CLI는 `npx supabase@latest`(3.2.0)로 실행. `functions deploy --use-api`가 "Docker 없이 서버 측 번들"로 확인됨.

### 공식 문서 확인

- **리전 변경은 "Restore to new project"(복제) 기능으로 불가** — 같은 리전에만 복원된다. 논리 덤프 방식이 맞다.
- 공식 절차는 `supabase db dump`(Docker 필요) + `psql --single-transaction --variable ON_ERROR_STOP=1 ... --command 'SET session_replication_role = replica' --file data.sql`. Docker가 없으므로 `pg_dump`로 같은 결과물을 만든다.
- 공식 data 덤프가 `auth`·`storage` 행을 포함하는지는 문서끼리 설명이 엇갈린다. 직접 `pg_dump`로 대상을 명시하므로 리허설 덤프 파일에서 `COPY auth.users` 등의 존재로 확인한다.
- IPv4 환경에서는 세션 풀러(`postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432`)로 접속. 실제 호스트는 대시보드 Connect 패널 값 사용.
- Storage는 공식 문서의 Node 스크립트 방식(버킷 생성 → 내려받기 → `upsert` 업로드)과 계획이 같다.
- **기존 JWT secret을 새 프로젝트에 재사용하면 기존 토큰이 유효**하다고 문서에 있으나, 기존 클라이언트는 기존 프로젝트 주소로 요청하므로 재로그인을 없애 주지는 못한다. 채택하지 않는다.
- 읽기 전용 전환 SQL: `ALTER DATABASE <db> SET default_transaction_read_only = true;` (해제는 `false`). 기존 연결에 즉시 적용되는지는 문서에 없어 리허설에서 확인.
- Vault·pgsodium 키 이전은 vault secret이 0건이라 불필요.

### 새 프로젝트 (2026-11-23 생성)

- ref `jgcaxbbajqmqhmhywiqc`, 이름 `studycore-renewal-seoul`, `ap-northeast-2`, Micro
- Session pooler 호스트: 새 `aws-1-ap-northeast-2.pooler.supabase.com:5432`, 기존 `aws-1-ap-south-1.pooler.supabase.com:5432`. 사용자명은 `postgres.<ref>`
- **API 키는 Legacy(JWT) 키를 쓴다.** 새 프로젝트는 `sb_publishable_`/`sb_secret_` 키가 기본으로 보이지만, 서버가 Edge Function을 `Authorization: Bearer <service role 키>`로 호출하므로(`api/notify/route.ts`, `consultation/service.ts`) JWT 형식이 아니면 함수 게이트웨이의 JWT 검증에서 거부될 수 있다. Legacy 탭에 `anon`·`service_role` 키가 있음을 확인. 코드 변경 없이 환경변수 3개만 교체하면 된다.
- 비밀값 입력 파일: `C:\Users\assag\.studycore-migration\secrets.env` (`OLD_DB_PASSWORD`, `NEW_DB_PASSWORD`, `NEW_ANON_KEY`, `NEW_SERVICE_ROLE_KEY`)

## 제약 · 건드리면 안 되는 것

- **광고 집행 중** (윈터스쿨 2027, 11/26 D1 소재 추가 예정, 루틴은 12/29까지). 리드 유실이 가장 큰 위험. 전환은 유입이 가장 적은 새벽에.
- 기존 프로젝트의 데이터는 전환 완료 전까지 **수정하지 않는다** (주소 치환은 새 DB에서만). 롤백 지점 보존.
- 덤프 파일에는 개인정보(이름·전화번호·비밀번호 해시)가 들어 있다. 저장소·Drive에 두지 않고 로컬 임시 폴더에만 두며, Phase 종료 시 삭제한다.
- DB 비밀번호·키 값은 문서·로그·커밋에 남기지 않는다. 환경변수 이름만 기록.
- 프로젝트 생성·삭제, 운영 환경변수 교체, 운영 재배포, 카카오 콘솔 변경은 단계마다 사용자 승인 후 진행.

## 검증하지 못한 것

- Vercel 프로젝트 설정 화면의 함수 리전 값 (응답 헤더로만 `iad1` 확인).
- 새 프로젝트 추가 시 실제 청구액 (요금표 단가로 계산한 추정만 있음).
- 함수와 DB를 서울에 함께 둔 뒤의 실제 응답 시간 개선폭.

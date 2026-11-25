# Phase 13: Supabase 서울 리전 이전 — Tasks

작성: 2026-11-23 · 설계는 `phase13-supabase-seoul-migration-plan.md`

표시: 🔐 = 실행 전 사용자 승인 필요 · 👤 = 사용자가 직접 해야 함 (비밀값 입력, 외부 콘솔)

## 0. 사전 조사 (완료)

- [x] Disk IO 경고 원인 확인 — 메모리 부족에 따른 스왑 (Nano, 스왑 485MB / RAM 411MB)
- [x] DB·Storage·Auth 규모 실측
- [x] 본문에 기존 프로젝트 주소가 든 테이블 전수 스캔 (5개 테이블)
- [x] Vercel 함수 리전 확인 (`iad1`)
- [x] Supabase 조직 소유 확인 (본인 Owner, 멤버 1명)
- [x] 의존 대상 목록화 (Vercel, 리포트 대시보드, Edge Function, 카카오, MCP·루틴)

## 1. 준비

- [x] 미결 사항 결정 (2026-11-23): 정리 크론 켠다 · 재로그인 공지 안 함 · Micro 즉시 상향 · 이전 계속 진행. 본 전환 일시는 리허설 결과로 확정
- [x] 새 프로젝트 추가 시 요금 확인 — 시간당 $0.01344, Nano→Micro는 무료 상향 (2026-11-23)
- [x] Postgres 17 클라이언트 설치 — `pg_dump`·`psql` 17.12 (2026-11-23)
- [x] Supabase 공식 문서로 덤프·복원 옵션 확정 (2026-11-23, context "공식 문서 확인")
- [x] 기존 프로젝트 Auth 설정 기록 (2026-11-23, context 표)
- [x] 기존 `storage.buckets` 설정 기록 (2026-11-23, context 표)
- [x] Docker 없는 Edge Function 배포 방법 확인 — `functions deploy --use-api` (2026-11-23)
- [x] 기존 Edge Function 4개의 JWT 검증 설정 확인 — 4개 모두 `verify_jwt=true` (2026-11-23 배포 때 대조)
- [x] Kakao provider의 동의 항목 등 내부 옵션 확인 (비밀값 제외), Refresh token 재사용 간격·이메일 템플릿 변경 여부 확인 — 2026-11-25 정리
  - Kakao: `client_id` 해시·scope 일치(3번 항목), 새 프로젝트로 로그인 성공(4번 항목)
  - `supabase config pull`로 두 프로젝트 설정을 저장소 밖 임시 폴더에 받아 비교: 기본값과 다른 항목 14개(Site URL·Redirect URL, 이메일 확인·발송 간격·OTP 길이, MFA TOTP, pooler 크기, Storage 옵션)가 두 프로젝트에서 같음(diff 0). 나머지 항목은 둘 다 기본값으로 판단. 비교 후 임시 파일 삭제
  - 이메일 템플릿은 pull 대상이 아니어서 대조 못 함. 스태프 계정은 `@studycore.internal` 가상 이메일이라 메일이 실제로 나가지 않으므로 영향 없음
- [x] 기존 프로젝트 Nano → Micro 상향 (2026-11-23 00:26 KST경, +$0.00/월). 재시작 후 RAM 904MB, Swap 104MB(11%), Memory commitment 1.15GB / 1.88GB, `shared_buffers` 256MB
- [x] 상향 다음 날 Swap 재확인 (2026-11-24 14:48 KST, 가동 38시간, metrics 엔드포인트 3분 간격 2회 측정): Swap 사용 235MB / 1GB(22%, 상향 직후 104MB보다 늘었으나 Nano 때 485MB의 절반), MemAvailable 568MB / 948MB. 3분 동안 swap-out 0페이지·swap-in 67페이지(약 270KB) → 스왑에 내려간 페이지는 쓰이지 않는 것이고 현재 스왑 활동은 사실상 없음
- [x] Disk IO balance 재확인 — metrics 엔드포인트에 없는 값이라 대시보드(Observability → Database)에서 확인 필요
  - 2026-11-25 13:13 KST 기존 프로젝트 최근 7일 화면(사용자 스크린샷). 이 화면에 IO budget 차트는 없어 IOPS·throughput을 한도와 비교: IOPS 7일 내내 1 미만 / 3,000, Disk throughput 최대 수십 KB/s / 125 MB/s(0.0%). 상향(11/23 00:26) 이후 Swap 선이 약 500MB → 약 200MB대로 내려가고 Total RAM 1.06GB로 늘어남, CPU IOwait의 작은 튐도 상향 후 사라짐
  - Memory commitment 차트에 `SEVERE` 배지: 상향 전에는 committed가 당시 한도선을 넘어 있었고, 상향 후 1.27GB / 1.88GB. 최근 24시간 화면(13:15 KST)에서는 배지 없음, committed 1.27GB로 평탄 → 배지는 7일 범위에 포함된 상향 전 구간 때문. 24시간 Swap 선 평탄, IOPS 1 미만, CPU 1.6%
- [x] 👤 `C:\Users\assag\.studycore-migration\db.env`에 기존·새 프로젝트의 Session pooler 연결 문자열 입력 (기존 DB 비밀번호를 모르면 Database 설정에서 재설정) — `db.env` 대신 같은 폴더의 `secrets.env`(DB 비밀번호 2개 + 새 프로젝트 키)로 대체, 3번 덤프·복원에 사용

## 2. 새 프로젝트 생성

- [x] 👤 `kkkseok` 조직에 서울(`ap-northeast-2`) 프로젝트 `studycore-renewal-seoul` 생성 — 생성 화면에 이름·리전·Micro·"Grant API access to new tables automatically"(기존 프로젝트 동작과 맞춤)까지 입력해 둠. DB 비밀번호 입력과 Create 클릭은 사용자가 직접 — 2026-11-23 생성
- [x] `pg_cron` 확장 활성화 후 복원 뒤 `054_add_cleanup_crons.sql` 적용 (결정: 켠다) — 3번에서 완료(크론 2개 등록)
- [x] 새 프로젝트 ref 기록 (이 문서 하단 "실행 기록") — `jgcaxbbajqmqhmhywiqc`
- [x] 필요한 확장 활성화 확인 (`uuid-ossp`, `pgcrypto`, `pg_stat_statements`) — 2026-11-25 `pg_extension` 대조: 세 확장 버전 동일(1.1·1.3·1.11). 새 프로젝트에 `pg_cron` 1.6.4 추가(의도), `supabase_vault`만 0.3.1→0.3.2(플랫폼 기본 버전 차이)

## 3. 리허설 이전 (운영 영향 없음)

- [x] 기존 DB 덤프 → `C:\Users\assag\.studycore-migration\dump\` (`public` 구조·데이터, `auth.users`·`auth.identities` 데이터, storage 정책, auth 트리거). 72초
- [x] 새 DB에 복원 (`--single-transaction`, `ON_ERROR_STOP=1`, 데이터 적재 전 `session_replication_role = replica`), exit 0, 9초
- [x] `auth.users`의 `on_auth_user_created` 트리거 존재 확인 (1개)
- [x] 대조 diff 0: 테이블 31개 행 수, 정책(public 95·storage 32), 함수 31, 트리거 14, 인덱스 98, RLS 테이블 29, 테이블 권한 609, 함수 권한 93, `consultations`·`profiles`·`auth.users` 데이터 해시
- [x] Storage 복사: 버킷 9개 생성(공개·크기·MIME 설정 동일), 164개 / 69.4MB, 실패 0, 버킷별 개수·바이트 일치. 87초
- [x] 주소 치환: 7개 컬럼(`questions`·`question_answers`의 `attachments`·`image_urls`, `notices.content`, `guide_sections.content_html`, `spaces.image_url`). 새 DB의 기존 ref 0건, 새 ref 78행, `updated_at` 보존, 표본 이미지 URL 200. 기존 DB는 78행 그대로
- [x] `pg_cron` 활성화 + 054 적용: `cleanup-rate-limits-daily`(0 19 * * *), `cleanup-audit-logs-weekly`(0 20 * * 0) 등록
- [x] Auth URL 설정 입력: Site URL, Redirect URL 3개. 가입 관련 토글은 기본값이 기존과 동일
- [x] 👤 새 프로젝트 Kakao provider 활성화 (Client ID/Secret 입력) — 2026-11-24. `/auth/v1/settings`에서 kakao·email만 켜짐(기존과 동일). 카카오 인가 주소의 `client_id` 해시와 scope(`account_email profile_image profile_nickname`)가 기존 프로젝트와 일치. Client Secret은 실제 로그인으로만 확인 가능
- [x] 👤 카카오 개발자 콘솔에 Redirect URI `https://jgcaxbbajqmqhmhywiqc.supabase.co/auth/v1/callback` 추가 (기존 것은 유지) — 2026-11-25 사용자 추가
- [x] Edge Function 4개 배포 (2026-11-23, `functions deploy --use-api --remote=jgcaxbbajqmqhmhywiqc`). 4개 모두 ACTIVE, `verify_jwt=true`(기존과 동일), 무인증 POST 401·OPTIONS 200 확인
  - 기존 프로젝트의 배포본을 내려받아 저장소와 비교: 차이는 `notify-consult/index.ts` 한 줄(`admission: "입소 상담"` → `"등록 상담"`). 2026-03-25 커밋 `ca609a2`의 용어 변경이 기존 운영에는 배포되지 않았던 것. 새 프로젝트에는 저장소 버전(“등록 상담”)이 올라감 → 관리자 알림톡의 상담 유형 표기가 바뀐다
- [x] 👤 Edge Function 시크릿 5개 등록 (`ADMIN_PHONE`, `KAKAO_CHANNEL_ID`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_PHONE`). **대시보드는 기존 값을 보여 주지 않고 SHA256 digest만 표시**하므로 원본 값은 문자 발송 서비스 콘솔 등에서 가져와야 한다. 등록 후 기존·새 프로젝트의 digest가 같은지로 값 일치를 확인
  - 2026-11-24 18:25 KST 등록. digest 대조: `KAKAO_CHANNEL_ID`·`SMS_SENDER_PHONE` 일치, `SMS_API_KEY`·`SMS_API_SECRET` 다름(Solapi 새 키를 추가 발급해 넣음 — 예상된 차이), `ADMIN_PHONE` 다름(사용자 확인: 같은 번호 → 입력 형식 차이). Solapi 기존 키는 삭제하지 않고 유지(사용자 확인) → 기존 운영 알림 영향 없음. 실제 동작은 테스트 상담 1건으로 확인
  - 함수는 전화번호의 숫자 외 문자를 지우고 쓰므로(`_shared/alimtalk.ts:112-113`, `_shared/sms.ts:105`) 하이픈 유무는 발송에 무관

## 4. 리허설 검증 (로컬)

- [x] `.env.local` 백업 후 새 프로젝트 값으로 교체 (Legacy JWT 키의 ref·role 확인). 검증 후 원본으로 복구함
- [x] 로컬 dev 서버 + 공개 페이지 6종 200 (`/`, `/notices`, `/blog`, `/manual`, `/landing/winter-2027`, `/about`)
- [x] `npx playwright test` 전체: 30 통과 / 7 실패 / 1 flaky / 1 skip. **이전으로 인한 실패 없음**
  - 6건은 기존 프로젝트에서도 똑같이 실패 (`auth/permission.spec.ts` 3건, `auth/route-guard.spec.ts` 3건 — `/notices`·`/manual` 비로그인 허용 등 현재 동작과 맞지 않는 오래된 테스트). 이번 범위 밖
  - 1건(`member/my-page.spec.ts` 프로필)은 global-setup의 멘토 로그인이 5초 타임아웃으로 실패해 이전 실행의 로그인 상태 파일이 남아 생긴 것. 재실행 시 통과
- [x] 스태프 로그인 API: admin·mentor·assistant 모두 200 (비밀번호 해시·`verify_staff_password` RPC 정상)
- [x] 기존 프로젝트 API 차단·해제 구문 검증 (plan 7번에 결과)
- [x] 카카오 로그인 수동 1회 (2026-11-25 12:11 KST): 새 프로젝트 `/auth/v1/authorize?provider=kakao`를 직접 열어 로그인 → `redirect_to`(localhost)로 `access_token` 반환(사용자 확인). 새 DB `auth.users.last_sign_in_at`·kakao identity `updated_at`이 로그인 시각으로 갱신, 새 사용자 0건(기존 계정에 연결). Client Secret·Redirect URI 정상
  - 로그인 화면의 카카오 버튼은 콜백을 `https://www.studycore.kr`로 고정(`src/app/login/page.tsx:48`)해 로컬 dev 서버로는 이 확인을 할 수 없음. 본 전환 후 운영에서 버튼으로 1회 더 확인(5번 완료 기준 6)
- [x] 테스트 상담 신청 1건 → 저장 + 알림 발송 — Edge Function 배포·시크릿 등록 후 (🔐 실제 알림톡·SMS가 발송됨)
  - 2차 (2026-11-25 12:42 KST): 사용자가 Solapi 새 키(v3) 허용 IP에 클라우드 공급사 AWS 서울(ap-northeast-2) 추가 후 `/api/consult` 200 → `notification_logs` 알림톡 `sent`(sentVia alimtalk). 새 Solapi 키·`KAKAO_CHANNEL_ID`·`ADMIN_PHONE` 정상
  - Solapi 정책: 기존 v1 키는 "모든 IP 허용", 새 v3 키는 IP 지정 필수이고 `0.0.0.0/0` 불가. 거절된 IP 43.201.22.115는 AWS `43.200.0.0/14`(ap-northeast-2 EC2). Edge Function이 서울 밖에서 실행되면 알림톡이 막힐 수 있음 → 본 전환 후 운영 알림 1건 확인 필수
  - 1차 (2026-11-25 12:30 KST, 로컬 dev 서버를 환경변수 덮어쓰기로 새 프로젝트에 연결, Meta·GA4 끔): `/api/consult` 200, 새 DB `consultations` 1행 저장(`homepage`). **알림 실패** — `notification_logs`: 알림톡 `[403] 허용되지 않은 IP(43.201.22.115)` → Solapi 새 API 키에 IP 제한이 걸려 있음. Edge Function은 고정 IP가 없으므로 새 키의 IP 제한을 풀어야 함(기존 키 설정과 맞추기)
  - 같은 건의 SMS 대체 발송은 `[400] DuplicatedSignature` — `_shared/alimtalk.ts`의 2차 SMS 요청이 1차 요청의 인증 헤더(같은 salt·signature)를 재사용하는 기존 버그. 기존 운영에서도 알림톡이 실패하면 SMS 대체가 항상 실패함(이전과 무관)
  - 수정 (2026-11-25): `_shared/alimtalk.ts` SMS 대체 요청, `_shared/sms.ts` `sendBulkSMS` 배치 요청이 요청마다 서명을 새로 생성. **새 프로젝트에만** 함수 4개 재배포(v3, ACTIVE, `verify_jwt=true`, 무인증 POST 401·OPTIONS 200, `notify-consult` 빈 body 400 — 부팅 정상). 기존 운영 프로젝트는 미배포 → 본 전환부터 적용. 대체 발송 경로는 알림톡 실패를 일부러 만들 수 없어 실발송 검증은 못 함
  - 상담 알림은 관리자 알림톡 1건뿐. 신청자 SMS는 함수에 없음(기존 운영 `notification_logs`도 관리자 건만). CLAUDE.md 알림 흐름의 "신청자 SMS"는 현재 코드와 달라 2026-11-25 수정
- [x] 리포트 대시보드 학부모 조회 경로 (2026-11-24): `rpt_students` 239행·데이터 해시·`rpt_meta.updated_at`(11/10) 두 DB 동일. anon 키로 REST `rpc/rpt_get_report` 호출 — 실제 학생 1명 응답(7005바이트) md5 동일, 없는 학생은 둘 다 `null`, anon의 `rpt_students` 직접 조회는 둘 다 0행(RLS 동일)
- [ ] 리포트 대시보드 관리자 화면(로그인 후 `rpt_*` 조회·업로드) — 대시보드를 새 프로젝트로 붙여야 확인 가능, 본 전환 때 확인
- [x] 이미지 업로드 (2026-11-24, `editor-images`): 비로그인 업로드 RLS 거부, 테스트 admin 계정 업로드 성공 → 공개 URL 200(`image/png`, 새 프로젝트 주소) → 삭제 성공 → 삭제 후 400. 테스트 파일은 남지 않음
- [x] E2E로 새 DB에 생긴 테스트 데이터(상담 1건 등)는 본 전환의 데이터 재적재 때 지워짐

## 5. 본 전환 (새벽, 전 단계 🔐)

- [ ] 전환 직전 기준값 기록(스냅샷 A): 테이블별 행 수·해시, `consultations` 마지막 건 시각, Storage 객체 수
- [ ] 직전 운영 배포 ID 기록 (Instant Rollback 대상)
- [ ] 새 DB `public`·`auth` 데이터 비우고 최종 덤프 복원 (`cron` 작업 정의는 유지)
- [ ] 행 수 대조 (완료 기준 1), 주소 치환 + 스캔 0건 (완료 기준 2)
- [ ] Storage 차분 복사 + 대조 (완료 기준 3)
- [ ] Vercel 운영 환경변수 3개 교체 (값은 출력하지 않음)
- [ ] `vercel.json`에 `"regions": ["icn1"]` 추가 (기존 `ignoreCommand` 유지) → 커밋·운영 배포
- [ ] `studycore-dashboard`의 `web/config.js` URL·anon 키 교체 → 배포
- [ ] 응답 헤더 `icn1::icn1::` 확인 (완료 기준 4), 운영 번들의 ref 확인 (완료 기준 5)
- [ ] 스태프 로그인 E2E(운영 대상 가능 범위) + 카카오 로그인 수동 1회 (완료 기준 6)
- [ ] 테스트 상담 1건 → 저장·알림 확인 후 삭제 (완료 기준 7)
- [ ] `report.studycore.kr` 조회 확인 (완료 기준 8)
- [ ] 랜딩 `/landing/winter-2027` 응답 및 리드 제출 경로 확인
- [ ] 👤 Supabase MCP 커넥터를 새 프로젝트로 재연결
- [ ] 광고 분석 루틴 2개(주간 v2, 매일 점검)가 새 프로젝트를 조회하는지 확인
- [ ] 기존 DB 재대조(스냅샷 B) → A와 다른 행이 있으면 새 DB에 수동 반영
- [ ] 기존 프로젝트 API 차단 (plan 7번, 검증 완료 후에만)
- [ ] `.env.local`·`.env.test` 대상 프로젝트 정리
- [ ] 실패 시: plan "롤백" 절차 수행 후 원인 보고

## 6. 관찰 (1~2주)

- [ ] 전환 다음 날: 새 프로젝트 Swap·Disk IO balance 확인 (완료 기준 9)
- [ ] 전환 다음 날: 응답 시간 전후 비교 (`/blog`, `/notices`, `/landing/winter-2027` 반복 측정)
- [ ] 매일 점검 루틴의 다음 실행 결과가 정상 수치인지 확인
- [ ] 기존 DB `max(created_at)`이 전환 시각 이전인지 주 2회 확인 (완료 기준 10)
- [ ] 기존 프로젝트 API 요청 로그 확인
- [ ] 미결 사항 1번(`pg_cron` 정리 작업) 결정에 따라 별도 적용

## 7. 정리

- [ ] 삭제 조건 충족 확인 (plan 9번) + 새 DB 주소 재스캔 0건
- [ ] 기존 DB 최종 덤프 로컬 보관
- [ ] 🔐 기존 프로젝트 삭제 (되돌릴 수 없음 — 삭제 대상 ref를 화면에서 재확인)
- [ ] 👤 🔐 카카오 콘솔의 기존 Redirect URI 제거
- [ ] 👤 🔐 Solapi의 기존 API Key 삭제 (기존 프로젝트가 쓰던 키. 전환 전에 지우면 운영 알림이 끊김)
- [ ] 로컬 덤프·복사 스크립트 삭제 (개인정보 포함)
- [ ] `docs/CHANGELOG.md` 기록
- [ ] `CLAUDE.md` 반영 검토 (함수 리전 `icn1`, 랜딩 캐시 설명 중 지연 관련 문구)
- [ ] `dev/active/PROJECT-STATUS.md` Phase 13 행 추가
- [ ] 메모리 `vercel-hosting-migration`의 "남은 일" 중 service role 키 재발급 항목 정리

## 실행 기록

| 날짜 | 내용 |
|------|------|
| 2026-11-22 | Disk IO 경고 조사, 원인 확인 |
| 2026-11-23 | 계획 문서 작성 |
| 2026-11-23 | 준비 단계: 요금·Auth 설정·버킷 설정 기록, 공식 문서 확인, Postgres 17 클라이언트 설치 |
| 2026-11-23 | 기존 프로젝트 Nano → Micro 상향 (00:26 KST경) |
| 2026-11-23 | 새 프로젝트 생성, 리허설 이전(DB·Storage·주소 치환·크론·Auth URL) 및 로컬 검증 완료. 남은 것: Kakao provider, Edge Function 배포·시크릿 (사용자 입력 필요) |
| 2026-11-24 | Micro 상향 후 스왑 재확인(활동 없음). 운영 페이지 200, 기존 DB 상담 34건(리허설 후 3건 유입 → 최종 덤프에서 이전됨). Supabase CLI 토큰이 권한을 잃어(프로젝트 목록 0개, 시크릿 조회 403) 사용자가 별도 터미널에서 재로그인. 시크릿 대조 결과 새 프로젝트에는 알림 시크릿 5개가 아직 0개 등록 (기본 `SUPABASE_*`만 있음) |
| 2026-11-24 | CLI가 `kkkseok` 조직이 없는 다른 계정(Vercel 연동 조직 `kkkseok-personal`·`glitzy`)으로 로그인돼 403이 재발 → `logout` 후 올바른 계정으로 재로그인. 사용자가 알림 시크릿 5개 등록, digest 대조(3번 항목 참고) |
| 2026-11-24 | Kakao provider 입력 확인(Client ID·scope 일치), 리포트 RPC·이미지 업로드 검증 통과. 남은 사용자 입력: 카카오 개발자 콘솔 Redirect URI |
| 2026-11-25 | 카카오 Redirect URI 추가(사용자), 새 프로젝트 카카오 로그인 성공(Client Secret 확인). 테스트 상담: 1차 Solapi IP 제한으로 실패 → AWS 서울 대역 허용 후 2차 알림톡 성공. 리허설(4번) 중 남은 것은 본 전환 때 확인하는 대시보드 관리자 화면뿐 |

- 새 프로젝트 ref: `jgcaxbbajqmqhmhywiqc` (2026-11-23 생성)
- 본 전환 일시: (확정 후 기록)
- 쓰기 동결 구간: (본 전환 후 기록)

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
- [ ] 기존 Edge Function 4개의 JWT 검증 설정 확인
- [ ] Kakao provider의 동의 항목 등 내부 옵션 확인 (비밀값 제외), Refresh token 재사용 간격·이메일 템플릿 변경 여부 확인
- [x] 기존 프로젝트 Nano → Micro 상향 (2026-11-23 00:26 KST경, +$0.00/월). 재시작 후 RAM 904MB, Swap 104MB(11%), Memory commitment 1.15GB / 1.88GB, `shared_buffers` 256MB
- [ ] 상향 다음 날 Swap·Disk IO balance 재확인
- [ ] 👤 `C:\Users\assag\.studycore-migration\db.env`에 기존·새 프로젝트의 Session pooler 연결 문자열 입력 (기존 DB 비밀번호를 모르면 Database 설정에서 재설정)

## 2. 새 프로젝트 생성

- [ ] 👤 `kkkseok` 조직에 서울(`ap-northeast-2`) 프로젝트 `studycore-renewal-seoul` 생성 — 생성 화면에 이름·리전·Micro·"Grant API access to new tables automatically"(기존 프로젝트 동작과 맞춤)까지 입력해 둠. DB 비밀번호 입력과 Create 클릭은 사용자가 직접 (2026-11-23 대기 중)
- [ ] `pg_cron` 확장 활성화 후 복원 뒤 `054_add_cleanup_crons.sql` 적용 (결정: 켠다)
- [ ] 새 프로젝트 ref 기록 (이 문서 하단 "실행 기록")
- [ ] 필요한 확장 활성화 확인 (`uuid-ossp`, `pgcrypto`, `pg_stat_statements`)

## 3. 리허설 이전 (운영 영향 없음)

- [x] 기존 DB 덤프 → `C:\Users\assag\.studycore-migration\dump\` (`public` 구조·데이터, `auth.users`·`auth.identities` 데이터, storage 정책, auth 트리거). 72초
- [x] 새 DB에 복원 (`--single-transaction`, `ON_ERROR_STOP=1`, 데이터 적재 전 `session_replication_role = replica`), exit 0, 9초
- [x] `auth.users`의 `on_auth_user_created` 트리거 존재 확인 (1개)
- [x] 대조 diff 0: 테이블 31개 행 수, 정책(public 95·storage 32), 함수 31, 트리거 14, 인덱스 98, RLS 테이블 29, 테이블 권한 609, 함수 권한 93, `consultations`·`profiles`·`auth.users` 데이터 해시
- [x] Storage 복사: 버킷 9개 생성(공개·크기·MIME 설정 동일), 164개 / 69.4MB, 실패 0, 버킷별 개수·바이트 일치. 87초
- [x] 주소 치환: 7개 컬럼(`questions`·`question_answers`의 `attachments`·`image_urls`, `notices.content`, `guide_sections.content_html`, `spaces.image_url`). 새 DB의 기존 ref 0건, 새 ref 78행, `updated_at` 보존, 표본 이미지 URL 200. 기존 DB는 78행 그대로
- [x] `pg_cron` 활성화 + 054 적용: `cleanup-rate-limits-daily`(0 19 * * *), `cleanup-audit-logs-weekly`(0 20 * * 0) 등록
- [x] Auth URL 설정 입력: Site URL, Redirect URL 3개. 가입 관련 토글은 기본값이 기존과 동일
- [ ] 👤 새 프로젝트 Kakao provider 활성화 (Client ID/Secret 입력)
- [ ] 👤 카카오 개발자 콘솔에 Redirect URI `https://jgcaxbbajqmqhmhywiqc.supabase.co/auth/v1/callback` 추가 (기존 것은 유지)
- [x] Edge Function 4개 배포 (2026-11-23, `functions deploy --use-api --remote=jgcaxbbajqmqhmhywiqc`). 4개 모두 ACTIVE, `verify_jwt=true`(기존과 동일), 무인증 POST 401·OPTIONS 200 확인
  - 기존 프로젝트의 배포본을 내려받아 저장소와 비교: 차이는 `notify-consult/index.ts` 한 줄(`admission: "입소 상담"` → `"등록 상담"`). 2026-03-25 커밋 `ca609a2`의 용어 변경이 기존 운영에는 배포되지 않았던 것. 새 프로젝트에는 저장소 버전(“등록 상담”)이 올라감 → 관리자 알림톡의 상담 유형 표기가 바뀐다
- [ ] 👤 Edge Function 시크릿 5개 등록 (`ADMIN_PHONE`, `KAKAO_CHANNEL_ID`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_PHONE`). **대시보드는 기존 값을 보여 주지 않고 SHA256 digest만 표시**하므로 원본 값은 문자 발송 서비스 콘솔 등에서 가져와야 한다. 등록 후 기존·새 프로젝트의 digest가 같은지로 값 일치를 확인

## 4. 리허설 검증 (로컬)

- [x] `.env.local` 백업 후 새 프로젝트 값으로 교체 (Legacy JWT 키의 ref·role 확인). 검증 후 원본으로 복구함
- [x] 로컬 dev 서버 + 공개 페이지 6종 200 (`/`, `/notices`, `/blog`, `/manual`, `/landing/winter-2027`, `/about`)
- [x] `npx playwright test` 전체: 30 통과 / 7 실패 / 1 flaky / 1 skip. **이전으로 인한 실패 없음**
  - 6건은 기존 프로젝트에서도 똑같이 실패 (`auth/permission.spec.ts` 3건, `auth/route-guard.spec.ts` 3건 — `/notices`·`/manual` 비로그인 허용 등 현재 동작과 맞지 않는 오래된 테스트). 이번 범위 밖
  - 1건(`member/my-page.spec.ts` 프로필)은 global-setup의 멘토 로그인이 5초 타임아웃으로 실패해 이전 실행의 로그인 상태 파일이 남아 생긴 것. 재실행 시 통과
- [x] 스태프 로그인 API: admin·mentor·assistant 모두 200 (비밀번호 해시·`verify_staff_password` RPC 정상)
- [x] 기존 프로젝트 API 차단·해제 구문 검증 (plan 7번에 결과)
- [ ] 카카오 로그인 수동 1회 — Kakao provider·Redirect URI 등록 후
- [ ] 테스트 상담 신청 1건 → 저장 + 알림 발송 — Edge Function 배포·시크릿 등록 후 (🔐 실제 알림톡·SMS가 발송됨)
- [ ] 리포트 대시보드를 새 프로젝트로 붙여 `rpt_get_report` 조회
- [ ] 이미지 업로드 1건 (storage 정책 동작 확인)
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

- 새 프로젝트 ref: `jgcaxbbajqmqhmhywiqc` (2026-11-23 생성)
- 본 전환 일시: (확정 후 기록)
- 쓰기 동결 구간: (본 전환 후 기록)

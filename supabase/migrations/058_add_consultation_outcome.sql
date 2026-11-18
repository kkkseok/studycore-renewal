-- ============================================
-- consultations: 상담 결과(대상 리드 여부·제외 사유·등록 여부) 컬럼 추가
--
-- 광고 성과를 "리드 수"가 아니라 "대상 리드 수·등록 수"로 판단하기 위해
-- 원장님이 통화 후 어드민 상담 관리에서 체크한다.
-- 주간 광고 분석 루틴은 이 컬럼을 건수 집계(count)로만 읽는다.
--
-- NULL = 아직 판정하지 않음 (기존 행은 모두 NULL로 시작)
-- 대상 리드 기준(2026-11-18 결정): 예비고1~고3·N수생. 최종 판정은 통화 후 원장님이 체크
--
-- 배포 순서: 이 마이그레이션을 먼저 적용한 뒤 어드민 코드를 배포한다.
-- (코드가 먼저 나가면 결과 저장 시 "없는 컬럼" 오류)
-- ============================================
BEGIN;

-- 다른 트랜잭션이 테이블을 오래 잡고 있으면 기다리지 않고 실패시킨다 (상담 저장 대기 방지)
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS is_target BOOLEAN,
  ADD COLUMN IF NOT EXISTS exclude_reason TEXT,
  ADD COLUMN IF NOT EXISTS enrolled BOOLEAN;

-- 제외 사유는 '대상 아님'(is_target = false)일 때 반드시 있고, 그 외에는 반드시 비어 있다.
-- CHECK는 NULL(UNKNOWN) 결과도 통과시키므로 IS FALSE / IS NOT FALSE로 NULL을 명시 처리한다.
-- model.ts의 consultationOutcomeSchema와 같은 규칙이다.
ALTER TABLE public.consultations
  DROP CONSTRAINT IF EXISTS consultations_exclude_reason_check;
ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_exclude_reason_check CHECK (
    (
      is_target IS FALSE
      AND exclude_reason IS NOT NULL
      AND exclude_reason IN ('grade', 'region', 'no_contact', 'other')
    )
    OR (is_target IS NOT FALSE AND exclude_reason IS NULL)
  );

COMMENT ON COLUMN public.consultations.is_target IS '대상 리드 여부 (NULL=미판정, true=대상, false=대상 아님). 통화 후 어드민에서 체크';
COMMENT ON COLUMN public.consultations.exclude_reason IS '대상 아님 사유: grade(학년) | region(지역·통학) | no_contact(연락 안 됨) | other(기타). is_target=false일 때만';
COMMENT ON COLUMN public.consultations.enrolled IS '등록 여부 (NULL=미정, true=등록, false=미등록)';

-- 공개 INSERT(anon 키로 REST 직접 호출)로 상담 결과 값을 미리 채워 넣지 못하게 한다.
-- 앱의 상담·리드 저장(/api/consult, /api/webhook/lead)은 createAdminClient로 RLS를 우회하고
-- 결과 컬럼을 보내지 않으므로 영향 없다. 기존 정책(033)은 WITH CHECK (TRUE).
DROP POLICY IF EXISTS "Anyone can create consultation" ON public.consultations;
CREATE POLICY "Anyone can create consultation"
  ON public.consultations FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_target IS NULL
    AND exclude_reason IS NULL
    AND enrolled IS NULL
  );

-- 조회(staff)·수정(admin·mentor) 정책은 컬럼 추가에 자동 적용되므로 변경 불필요.

COMMIT;

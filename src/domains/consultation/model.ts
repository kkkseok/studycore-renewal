/**
 * Consultation 도메인 - 모델 정의
 *
 * 이 파일에는 타입과 Zod 스키마만 포함합니다.
 * ⚠️ 비즈니스 로직 금지 → service.ts
 * ⚠️ DB 쿼리 금지 → repository.ts
 */

import { z } from "zod";

// 상담 상태
export const ConsultationStatus = {
  NEW: "new",
  CONTACTED: "contacted",
  DONE: "done",
} as const;

export type ConsultationStatusType =
  (typeof ConsultationStatus)[keyof typeof ConsultationStatus];

// 상담 유형
export const ConsultationType = {
  ADMISSION: "admission", // 등록 상담
  TOUR: "tour", // 시설 견학
  PROGRAM: "program", // 프로그램 문의
  ETC: "etc", // 기타
} as const;

export type ConsultationTypeValue =
  (typeof ConsultationType)[keyof typeof ConsultationType];

// 대상 리드가 아닌 사유 (마이그레이션 058 CHECK 제약과 동일한 값)
export const ExcludeReason = {
  GRADE: "grade", // 학년이 대상 밖 (중학생 등)
  REGION: "region", // 지역·통학 불가
  NO_CONTACT: "no_contact", // 연락 안 됨
  OTHER: "other", // 기타
} as const;

export type ExcludeReasonType =
  (typeof ExcludeReason)[keyof typeof ExcludeReason];

const excludeReasonValues = ["grade", "region", "no_contact", "other"] as const;

// ─────────────────────────────────────────────
// Zod 스키마
// ─────────────────────────────────────────────

// 상담 신청 폼 스키마 (클라이언트 유효성 검사용)
//
// 기본 홈페이지 상담폼(/consult)은 name/phone/school/consultType/message만 전송한다.
// grade/source/utm/marketingConsent는 광고 랜딩페이지 리드(/api/webhook/lead)에서만
// 채워지는 optional 필드이며, 홈페이지 폼 동작에는 영향을 주지 않는다.
export const consultationFormSchema = z.object({
  name: z
    .string()
    .min(2, "이름은 2자 이상 입력해주세요")
    .max(50, "이름은 50자 이하로 입력해주세요"),
  phone: z
    .string()
    .regex(
      /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
      "올바른 전화번호 형식을 입력해주세요"
    ),
  school: z
    .string()
    .max(100, "학교 및 학년은 100자 이하로 입력해주세요")
    .optional(),
  consultType: z.enum(["admission", "tour", "program", "etc"], {
    message: "상담 유형을 선택해주세요",
  }),
  message: z
    .string()
    .max(1000, "문의 내용은 1000자 이하로 입력해주세요")
    .optional(),
  // ── 광고/캠페인 리드 유입 추적 (랜딩페이지 전용, optional) ──
  grade: z.string().max(20, "학년은 20자 이하로 입력해주세요").optional(),
  source: z.string().max(80).optional(),
  utm: z.record(z.string(), z.unknown()).nullable().optional(),
  marketingConsent: z.boolean().optional(),
});

export type ConsultationFormInput = z.infer<typeof consultationFormSchema>;

// 상담 DB 레코드 스키마
export const consultationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  school: z.string().nullable(),
  grade: z.string().nullable(),
  consult_type: z.string(),
  message: z.string().nullable(),
  status: z.enum(["new", "contacted", "done"]),
  created_at: z.string(),
  // 유입 추적 컬럼 (마이그레이션 056). source/marketing_consent는 NOT NULL DEFAULT.
  source: z.string(),
  utm: z.record(z.string(), z.unknown()).nullable(),
  marketing_consent: z.boolean(),
  // 상담 결과 컬럼 (마이그레이션 058). NULL = 아직 판정하지 않음.
  is_target: z.boolean().nullable(),
  exclude_reason: z.enum(excludeReasonValues).nullable(),
  enrolled: z.boolean().nullable(),
});

export type Consultation = z.infer<typeof consultationSchema>;

// 상담 결과 수정 스키마 (어드민, 부분 업데이트).
// 보낸 칸만 바꾼다: 대상 판정(is_target + exclude_reason은 항상 한 묶음)과 등록(enrolled)은
// 서로 독립이라, 한쪽 저장이 다른 쪽 값을 오래된 값으로 덮어쓰지 않는다.
// 대상 아님이면 제외 사유가 있어야 하고, 대상·미판정이면 제외 사유를 비운다
// (마이그레이션 058의 CHECK 제약과 같은 규칙).
export const consultationOutcomeSchema = z
  .object({
    is_target: z.boolean().nullable().optional(),
    exclude_reason: z.enum(excludeReasonValues).nullable().optional(),
    enrolled: z.boolean().nullable().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasTarget = v.is_target !== undefined || v.exclude_reason !== undefined;
    if (!hasTarget && v.enrolled === undefined) {
      ctx.addIssue({ code: "custom", message: "변경할 값이 없습니다" });
      return;
    }
    if (!hasTarget) return;
    if (v.is_target === undefined || v.exclude_reason === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "대상 여부와 제외 사유는 함께 저장해야 합니다",
      });
      return;
    }
    if (v.is_target === false && v.exclude_reason === null) {
      ctx.addIssue({ code: "custom", message: "대상 아님 사유를 선택해주세요" });
    }
    if (v.is_target !== false && v.exclude_reason !== null) {
      ctx.addIssue({
        code: "custom",
        message: "제외 사유는 '대상 아님'일 때만 선택할 수 있습니다",
      });
    }
  });

export type ConsultationOutcomeInput = z.infer<typeof consultationOutcomeSchema>;

// 상담 생성용 스키마 (id, status, created_at 제외)
export const createConsultationSchema = consultationFormSchema.transform(
  (data) => ({
    name: data.name,
    phone: data.phone.replace(/-/g, ""), // 하이픈 제거
    school: data.school || null,
    grade: data.grade || null,
    consult_type: data.consultType,
    message: data.message || null,
    status: ConsultationStatus.NEW,
    source: data.source || "homepage",
    utm: data.utm ?? null,
    marketing_consent: data.marketingConsent ?? false,
  })
);

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

// ─────────────────────────────────────────────
// API 응답 타입
// ─────────────────────────────────────────────

/** 상담 신청 API 성공 응답 */
export interface ConsultationSuccessResponse {
  success: true;
  message: string;
  consultationId: string;
  /** Meta CAPI Lead 이벤트 ID (브라우저 픽셀에 전달하여 서버-브라우저 이벤트 중복 제거) */
  eventId: string;
}

/** 상담 신청 API 실패 응답 */
export interface ConsultationErrorResponse {
  success: false;
  error: string;
}

/** 상담 신청 API 응답 (Union Type) */
export type ConsultationApiResponse =
  | ConsultationSuccessResponse
  | ConsultationErrorResponse;

/** 서비스 레이어 결과 타입 */
export interface ConsultationServiceResult {
  success: boolean;
  consultation?: Consultation;
  error?: string;
}

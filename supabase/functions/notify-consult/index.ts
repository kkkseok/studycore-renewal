/**
 * 상담 신청 알림 Edge Function
 *
 * 트리거: 상담 신청 폼 제출
 * 발송 대상:
 *   1. 관리자 (알림톡 → SMS fallback)
 *   2. 신청자 — source가 `_shared/lead-guides.ts`에 있는 광고 랜딩일 때만 안내
 *      (알림톡 템플릿이 있으면 알림톡 → 실패 시 LMS, 없으면 LMS)
 *      (같은 번호는 LEAD_GUIDE_DEDUPE_DAYS 안에 다시 보내지 않음)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendSMS } from "../_shared/sms.ts";
import { sendAlimtalk, ALIMTALK_TEMPLATES } from "../_shared/alimtalk.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  hasRecentGuideSent,
  logNotification,
} from "../_shared/notification-logger.ts";
import { LEAD_GUIDES, LEAD_GUIDE_DEDUPE_DAYS } from "../_shared/lead-guides.ts";

interface ConsultNotifyRequest {
  name: string;
  phone: string;
  school?: string;
  consultType?: string;
  message?: string;
  /** consultations.source (랜딩 slug 또는 homepage) */
  source?: string;
}

type ApplicantGuideResult = "none" | "sent" | "skipped_duplicate" | "failed";

const CONSULT_TYPE_LABELS: Record<string, string> = {
  admission: "등록 상담",
  tour: "시설 견학",
  program: "프로그램 문의",
  etc: "기타",
};

serve(async (req: Request) => {
  // CORS 처리
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: ConsultNotifyRequest = await req.json();

    // 필수 필드 검증
    if (!body.name || !body.phone) {
      return new Response(
        JSON.stringify({ error: "이름과 연락처는 필수입니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const results = {
      adminNotified: false,
      applicantGuide: "none" as ApplicantGuideResult,
      errors: [] as string[],
    };

    // 1. 관리자에게 알림 발송 (알림톡 우선 → SMS fallback)
    if (adminPhone) {
      const consultTypeLabel = CONSULT_TYPE_LABELS[body.consultType || ""] || body.consultType || "-";
      const adminMessage = `[스터디코어 1.0] 새 상담 신청이 접수되었습니다.

이름: ${body.name}
연락처: ${body.phone}
학교/학년: ${body.school || "-"}
유형: ${consultTypeLabel}
문의: ${body.message || "-"}

관리자 페이지에서 확인해 주세요.`;

      // 알림톡 시도 (실패 시 내부에서 SMS fallback)
      const result = await sendAlimtalk({
        to: adminPhone,
        templateCode: ALIMTALK_TEMPLATES.CONSULT_ADMIN,
        variables: {
          이름: body.name,
          연락처: body.phone,
          학교학년: body.school || "-",
          유형: consultTypeLabel,
          메시지: body.message || "-",
        },
        fallbackMessage: adminMessage,
      });

      results.adminNotified = result.success;

      // 발송 로그 기록
      await logNotification({
        type: result.sentVia || "alimtalk",
        recipient_phone: adminPhone,
        recipient_name: "관리자",
        message: adminMessage,
        template_code: ALIMTALK_TEMPLATES.CONSULT_ADMIN,
        status: result.success ? "sent" : "failed",
        error_message: result.success ? undefined : result.error,
        metadata: {
          trigger: "consult",
          customerName: body.name,
          sentVia: result.sentVia,
          alimtalkError: result.alimtalkError || undefined,
        },
      });

      if (!result.success) {
        results.errors.push(`관리자 알림 실패: ${result.error || "알 수 없는 오류"}`);
      }
    }

    // 2. 광고 랜딩 신청자에게 안내 (알림톡 우선 → LMS)
    // source는 랜딩 요청 값이라 hasOwn으로만 조회 ("constructor" 같은 프로토타입 키 차단)
    const guide =
      body.source && Object.hasOwn(LEAD_GUIDES, body.source)
        ? LEAD_GUIDES[body.source]
        : undefined;
    if (guide) {
      const applicantPhone = body.phone.replace(/[^0-9]/g, "");

      // 중복 확인 실패 시에도 안내는 보낸다(누락보다 중복이 덜 해로움). 실패 사유는 로그에 남긴다.
      let dedupeError: string | undefined;
      let alreadySent = false;
      try {
        alreadySent = await hasRecentGuideSent(
          applicantPhone,
          guide.key,
          LEAD_GUIDE_DEDUPE_DAYS
        );
      } catch (error) {
        dedupeError = error instanceof Error ? error.message : String(error);
        console.error("안내 중복 확인 실패:", dedupeError);
      }

      if (alreadySent) {
        results.applicantGuide = "skipped_duplicate";
      } else {
        // 알림톡 템플릿이 있으면 알림톡 → (요청 실패 시) LMS, 없으면 바로 LMS
        let guideResult: {
          success: boolean;
          messageId?: string;
          error?: string;
          sentVia: "alimtalk" | "sms";
          alimtalkError?: string;
        };
        if (guide.alimtalk) {
          const result = await sendAlimtalk({
            to: applicantPhone,
            templateCode: guide.alimtalk.templateCode,
            variables: { 이름: body.name },
            fallbackMessage: guide.text,
            fallbackSubject: guide.subject,
            // LMS 본문은 템플릿과 다른 글이라 알림톡 요청에는 싣지 않는다
            omitRequestText: true,
          });
          guideResult = {
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            // 둘 다 실패하면 마지막 시도가 LMS
            sentVia: result.sentVia || "sms",
            alimtalkError: result.alimtalkError,
          };
        } else {
          const smsResult = await sendSMS({
            to: applicantPhone,
            subject: guide.subject,
            message: guide.text,
          });
          guideResult = { ...smsResult, sentVia: "sms" };
        }
        results.applicantGuide = guideResult.success ? "sent" : "failed";

        const sentAsAlimtalk = guideResult.sentVia === "alimtalk" && guide.alimtalk;
        await logNotification({
          type: guideResult.sentVia,
          recipient_phone: applicantPhone,
          recipient_name: body.name,
          message: sentAsAlimtalk
            ? guide.alimtalk!.logText(body.name)
            : guide.text,
          template_code: sentAsAlimtalk
            ? guide.alimtalk!.templateCode
            : undefined,
          status: guideResult.success ? "sent" : "failed",
          error_message: guideResult.success ? undefined : guideResult.error,
          metadata: {
            trigger: "consult_guide",
            guide: guide.key,
            source: body.source,
            messageId: guideResult.messageId,
            sentVia: guideResult.sentVia,
            alimtalkError: guideResult.alimtalkError || undefined,
            dedupeError,
          },
        });

        if (!guideResult.success) {
          results.errors.push(`신청자 안내 실패: ${guideResult.error || "알 수 없는 오류"}`);
        }
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-consult error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

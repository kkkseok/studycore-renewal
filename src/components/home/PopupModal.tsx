"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import { getActivePopups } from "@/domains/popup/service";
import { getNoticeAttachments } from "@/domains/notice/service";
import type { Popup } from "@/domains/popup/model";
import { MetaAttachmentList, AttachmentModal } from "@/components/common";
import type { NoticeAttachment } from "@/domains/notice/model";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { sanitizeHtml } from "@/lib/sanitize";

function isDismissedToday(popupId: string): boolean {
  const key = `popup_dismissed_${popupId}`;
  const dismissed = localStorage.getItem(key);
  if (!dismissed) return false;
  const today = new Date().toISOString().split("T")[0];
  return dismissed === today;
}

function dismissToday(popupId: string) {
  const key = `popup_dismissed_${popupId}`;
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(key, today);
}

// 모바일에서는 첫 화면을 가리는 전면 팝업 대신 하단 배너로 알린다
// (구글 모바일 전면 팝업 감점 + 레이아웃 이동(CLS) 방지). 배너를 누르면 같은 팝업이 열린다.
const MOBILE_QUERY = "(max-width: 767px)";

export function PopupModal() {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
  const [noticeHtml, setNoticeHtml] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    async function loadPopup() {
      const supabase = createBrowserClient();
      const popups = await getActivePopups(supabase);
      const visible = popups.find((p) => !isDismissedToday(p.id));
      if (!visible) return;

      // 공지 연결 시 원본 HTML + 첨부파일을 먼저 다 불러온 뒤 연다.
      // 열린 뒤에 본문이 바뀌면 팝업 크기가 커지며 내용이 밀린다(CLS).
      if (visible.notice_id) {
        const [atts, { data: notice }] = await Promise.all([
          getNoticeAttachments(supabase, visible.notice_id),
          supabase
            .from("notices")
            .select("content")
            .eq("id", visible.notice_id)
            .single(),
        ]);
        setAttachments(atts);
        if (notice?.content) {
          setNoticeHtml(notice.content);
        }
      }

      setPopup(visible);
      if (window.matchMedia(MOBILE_QUERY).matches) {
        setShowBanner(true);
      } else {
        setIsOpen(true);
      }
    }
    loadPopup();
  }, []);

  const handleClose = () => setIsOpen(false);

  const handleDismissToday = () => {
    if (popup) dismissToday(popup.id);
    setIsOpen(false);
    setShowBanner(false);
  };

  const openFromBanner = () => {
    setShowBanner(false);
    setIsOpen(true);
  };

  const linkUrl = popup?.notice_id
    ? `/notices/${popup.notice_id}`
    : popup?.link_url || null;

  const hasImage = !!popup?.image_url;

  return (
    <>
    {/* 배너 높이만큼 페이지 끝 여백 — 고정 배너가 푸터 마지막 줄을 가리지 않게.
        Footer 뒤에 렌더되므로 위쪽 콘텐츠를 밀지 않는다(CLS 없음) */}
    {showBanner && popup && <div aria-hidden="true" className="h-16" />}
    {/* 모바일 하단 공지 배너 (본문을 가리지 않음) */}
    {showBanner && popup && (
      <div
        role="region"
        aria-label="공지"
        className="fixed inset-x-0 bottom-0 z-[9997] flex items-center gap-3 border-t border-teal/40 bg-navy px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white"
      >
        <button
          type="button"
          onClick={openFromBanner}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          <span className="shrink-0 text-caption font-medium tracking-label text-teal">
            공지
          </span>
          <span className="truncate text-secondary font-medium">{popup.title}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-teal" />
        </button>
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          aria-label="공지 배너 닫기"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-white/60 hover:text-white transition-colors duration-200 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )}
    <AnimatePresence>
      {isOpen && popup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-ink/60 backdrop-blur-[2px] p-4"
          onClick={handleClose}
        >
          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-modal-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md border border-rule bg-white overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={handleClose}
              aria-label="닫기"
              className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center transition-colors cursor-pointer ${
                hasImage
                  ? "bg-ink/50 text-white hover:bg-ink/80"
                  : "text-muted hover:text-ink"
              }`}
            >
              <X className="h-4 w-4" />
            </button>

            {/* 이미지 */}
            {hasImage && (
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={popup.image_url!}
                  alt={popup.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* 헤더 + 콘텐츠 */}
            <div className="p-6">
              {/* 라벨 */}
              {popup.notice_id && (
                <span className="inline-block mb-3 text-caption font-medium tracking-label uppercase text-teal">
                  공지사항
                </span>
              )}

              <h3
                id="popup-modal-title"
                className="font-serif text-fluid-h3 font-bold text-navy leading-heading tracking-heading"
              >
                {popup.title}
              </h3>

              {/* 구분선 */}
              <div className="my-4 h-px bg-rule" />

              {/* 본문: 공지 연결 시 HTML, 아닐 때 평문 */}
              {noticeHtml ? (
                <div
                  className="prose prose-sm max-w-none text-body leading-prose text-ink/80 max-h-[40vh] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(noticeHtml) }}
                />
              ) : popup.content ? (
                <p className="whitespace-pre-wrap text-body text-ink/80 leading-prose">
                  {popup.content}
                </p>
              ) : null}

              {/* 공지 첨부파일 */}
              {attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-rule">
                  <MetaAttachmentList attachments={attachments} onSelect={setSelectedImage} />
                </div>
              )}

              {/* CTA 버튼 */}
              {linkUrl && (
                <a
                  href={linkUrl}
                  className="mt-5 inline-flex items-center gap-2 border-[1.5px] border-navy bg-navy px-5 py-2.5 text-secondary font-bold tracking-cta text-white hover:bg-navy-dark transition-colors duration-200 cursor-pointer"
                >
                  {popup.link_text || "자세히 보기"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* 오늘 하루 안 보기 */}
            <div className="border-t border-rule px-6 py-3 bg-stone/50">
              <button
                onClick={handleDismissToday}
                className="text-caption text-muted hover:text-ink transition-colors duration-200 cursor-pointer"
              >
                오늘 하루 안 보기
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {selectedImage && (
      <AttachmentModal url={selectedImage} onClose={() => setSelectedImage(null)} />
    )}
    </>
  );
}

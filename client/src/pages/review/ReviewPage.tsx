/**
 * 复习页 — 三种状态：
 *   1. 无到期卡片 → 空状态
 *   2. 复习会话中 → ReviewSession
 *   3. 会话完成 → ReviewComplete
 */

import { useEffect } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { useDomainStore } from "@/stores/domainStore";
import { ReviewSession } from "./ReviewSession";
import { ReviewComplete } from "./ReviewComplete";

export function ReviewPage() {
  const isActive = useReviewStore((s) => s.isActive);
  const sessionStats = useReviewStore((s) => s.sessionStats);
  const currentIndex = useReviewStore((s) => s.currentIndex);
  const startSession = useReviewStore((s) => s.startSession);
  const endSession = useReviewStore((s) => s.endSession);

  const isLoaded = useDomainStore((s) => s.isLoaded);
  const loadAll = useDomainStore((s) => s.loadAll);

  useEffect(() => {
    if (!isLoaded) loadAll();
  }, [isLoaded, loadAll]);

  const isComplete = !isActive && sessionStats.completed > 0;

  // ── 状态 3：完成 ──
  if (isComplete) return <ReviewComplete />;

  // ── 状态 2：会话中 ──
  if (isActive) {
    return (
      <div className="flex flex-col h-full">
        {/* 顶栏 */}
        <div className="flex-shrink-0 px-5 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => endSession()}
              className="text-body text-brand-blue tap-active"
            >
              ← 返回
            </button>
            <span className="text-caption text-text-secondary select-none">
              复习
            </span>
            <span className="text-caption text-text-tertiary select-none">
              {currentIndex + 1} / {sessionStats.total}
            </span>
          </div>
          <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-blue rounded-full transition-all duration-500"
              style={{
                width: `${sessionStats.total > 0
                  ? (sessionStats.completed / sessionStats.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ReviewSession />
        </div>
      </div>
    );
  }

  // ── 状态 1：空状态 ──
  return (
    <div className="scroll-container flex items-center justify-center">
      <div className="text-center px-5 w-full max-w-[320px]">
        <span className="text-5xl block mb-4 select-none">🔄</span>
        <h2 className="text-section-title text-text-primary mb-2">复习</h2>
        <p className="text-caption text-text-secondary mb-2">
          艾宾浩斯算法会在遗忘临界点提醒你
        </p>
        <p className="text-caption text-text-tertiary mb-6">
          暂时没有到期的卡片
        </p>
        <button
          onClick={() => startSession()}
          className="w-full h-[48px] bg-brand-blue text-text-inverse rounded-button text-btn-text tap-active shadow-button"
        >
          检查复习队列 →
        </button>
      </div>
    </div>
  );
}

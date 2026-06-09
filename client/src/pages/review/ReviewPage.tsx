import { useEffect } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { useDomainStore } from "@/stores/domainStore";
import { ReviewSession } from "./ReviewSession";
import { ReviewComplete } from "./ReviewComplete";

export function ReviewPage() {
  const isActive = useReviewStore((s) => s.isActive);
  const stats = useReviewStore((s) => s.sessionStats);
  const idx = useReviewStore((s) => s.currentIndex);
  const startSession = useReviewStore((s) => s.startSession);
  const endSession = useReviewStore((s) => s.endSession);
  const isLoaded = useDomainStore((s) => s.isLoaded);
  const loadAll = useDomainStore((s) => s.loadAll);

  useEffect(() => { if (!isLoaded) loadAll(); }, [isLoaded, loadAll]);

  if (!isActive && stats.completed > 0) return <ReviewComplete />;

  if (isActive) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-5 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => endSession()} className="text-body text-brand-blue tap-active">← 返回</button>
            <span className="text-caption text-text-secondary">{idx + 1} / {stats.total}</span>
          </div>
          <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue rounded-full transition-all duration-500" style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex-1 min-h-0"><ReviewSession /></div>
      </div>
    );
  }

  return (
    <div className="scroll-container flex items-center justify-center">
      <div className="text-center px-5">
        <span className="text-5xl block mb-4">🔄</span>
        <h2 className="text-section-title mb-2">复习</h2>
        <p className="text-caption text-text-secondary mb-6">艾宾浩斯算法会在遗忘临界点提醒你</p>
        <button onClick={() => startSession()} className="w-full h-[48px] bg-brand-blue text-white rounded-button text-btn-text tap-active">开始复习 →</button>
      </div>
    </div>
  );
}

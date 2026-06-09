/**
 * 薄弱知识点区块
 *
 * 按错误情况降序排列，每项显示错误统计 + 强化入口。
 */

import { useFocusStore } from "@/stores/focusStore";
import { useUIStore } from "@/stores/uiStore";

export function WeakPointSection() {
  const weakCards = useFocusStore((s) => s.weakCards);
  const weakPoints = useFocusStore((s) => s.weakPoints);
  const setTab = useUIStore((s) => s.setTab);

  // 按 consecutiveErrors 降序排列
  const sorted = [...weakCards].sort(
    (a, b) => (b.consecutiveErrors ?? 0) - (a.consecutiveErrors ?? 0)
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card px-5 py-6 mb-6">
        <h3 className="text-section-title text-text-primary mb-3">📉 薄弱知识点</h3>
        <div className="text-center py-4">
          <span className="text-3xl select-none">🎉</span>
          <p className="text-caption text-text-secondary mt-2">
            目前没有薄弱知识点，继续保持！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card px-5 py-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title text-text-primary">
          📉 薄弱知识点
        </h3>
        <span className="text-caption text-text-tertiary">{sorted.length} 个</span>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((card) => {
          const point = weakPoints.find((p) => p.id === card.pointId);
          const errorRate = card.totalReviews > 0
            ? Math.round(((card.totalReviews - card.totalCorrect) / card.totalReviews) * 100)
            : 0;
          const maxBarWidth = 100;

          return (
            <div
              key={card.id}
              className="border border-divider rounded-card px-4 py-3"
            >
              <p className="text-body text-text-primary font-medium mb-1 truncate">
                {point?.title ?? card.pointId}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-label text-semantic-danger">
                  错误率 {errorRate}%
                </span>
                <span className="text-label text-text-tertiary">
                  · 错误 {card.consecutiveErrors ?? card.totalReviews - card.totalCorrect} 次
                </span>
              </div>
              {/* 错误率进度条 */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-semantic-danger rounded-full"
                  style={{ width: `${Math.min(errorRate, maxBarWidth)}%` }}
                />
              </div>
              {card.weakReason && (
                <p className="text-label text-text-tertiary mb-2">
                  {card.weakReason}
                </p>
              )}
              <button
                onClick={() => setTab("learn")}
                className="text-label text-brand-blue tap-active"
              >
                强化练习 →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

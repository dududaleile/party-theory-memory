/**
 * 卡片正面 — 问题面
 *
 * 唯一焦点：问题文字
 * 辅助信息：面包屑（知识树位置）
 * 操作：翻转按钮（「我已思考，查看答案」）
 */

import { CardBreadcrumb } from "./CardBreadcrumb";

interface CardFrontProps {
  question: string;
  breadcrumbPath: string[];
  /** 复习特有信息（学习页不传） */
  reviewInfo?: {
    lastReviewText: string;
    historyCorrectRate: string;
    reviewCount: number;
  };
  onFlip: () => void;
  isAnimating: boolean;
}

export function CardFront({
  question,
  breadcrumbPath,
  reviewInfo,
  onFlip,
  isAnimating,
}: CardFrontProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 面包屑 */}
      <CardBreadcrumb path={breadcrumbPath} />

      {/* 复习信息条 */}
      {reviewInfo && (
        <div className="flex items-center gap-3 mb-4 px-2 py-1.5 bg-gray-50 rounded-tag">
          <span className="text-label text-text-tertiary">
            ⏱ {reviewInfo.lastReviewText}
          </span>
          <span className="text-label text-text-tertiary">
            📈 {reviewInfo.historyCorrectRate}
          </span>
          <span className="text-label text-text-tertiary">
            🔄 第 {reviewInfo.reviewCount} 次
          </span>
        </div>
      )}

      {/* 问题文字 — 绝对焦点 */}
      <div className="flex-1 flex items-center justify-center min-h-[160px]">
        <p className="text-card-title text-text-primary text-center leading-relaxed px-4 select-none">
          {question}
        </p>
      </div>

      {/* 翻转按钮 — 拇指触达区 */}
      <div className="mt-auto pb-2">
        <button
          onClick={onFlip}
          disabled={isAnimating}
          className="
            w-full h-[48px] bg-brand-blue text-text-inverse
            rounded-button text-btn-text tap-active
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          我已思考，查看答案 →
        </button>
      </div>
    </div>
  );
}

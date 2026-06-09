/**
 * ReviewSession — 单张复习卡片循环
 *
 * 与 LearnSession 共享 FlipCard 组件，但增加：
 *   1. 复习特有信息条（上次时间、正确率、次数）
 *   2. AI 判分输入区（论述题）
 *   3. 下次复习时间预测
 */

import { useMemo } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { useDomainStore } from "@/stores/domainStore";
import { FlipCard } from "@/components/card/FlipCard";
import { CardFront } from "@/components/card/CardFront";
import { CardBack } from "@/components/card/CardBack";
import { RatingButtons } from "@/components/rating/RatingButtons";

export function ReviewSession() {
  const current = useReviewStore((s) => s.current);
  const isFlipped = useReviewStore((s) => s.isFlipped);
  const isAnimating = useReviewStore((s) => s.isAnimating);
  const keywords = useReviewStore((s) => s.keywords);
  const aiMode = useReviewStore((s) => s.aiMode);
  const userAnswer = useReviewStore((s) => s.userAnswer);
  const isAiScoring = useReviewStore((s) => s.isAiScoring);
  const aiResult = useReviewStore((s) => s.aiResult);
  const flipCard = useReviewStore((s) => s.flipCard);
  const toggleKeyword = useReviewStore((s) => s.toggleKeyword);
  const rateCard = useReviewStore((s) => s.rateCard);
  const setUserAnswer = useReviewStore((s) => s.setUserAnswer);
  const submitForAiScoring = useReviewStore((s) => s.submitForAiScoring);

  const domainMap = useDomainStore((s) => s.domainMap);

  const breadcrumbPath = useMemo(() => {
    if (!current?.point?.treePath) return [];
    return current.point.treePath
      .map((id) => domainMap[id]?.name)
      .filter((name): name is string => Boolean(name));
  }, [current, domainMap]);

  if (!current) return null;

  const { card, point, lastReviewText, historyCorrectRate, reviewCount, isShortCycle } = current;

  return (
    <div className="flex flex-col h-full">
      {/* 短周期标记 */}
      {isShortCycle && (
        <div className="px-5 pt-2">
          <div className="bg-orange-50 text-semantic-warning text-label px-3 py-1 rounded-tag text-center">
            ⚡ 关键词遗漏，短周期强化复习
          </div>
        </div>
      )}

      {/* 卡片区域 */}
      <div className="flex-1 flex items-start pt-3 px-5">
        <FlipCard
          isFlipped={isFlipped}
          front={
            <CardFront
              question={point?.question ?? ""}
              breadcrumbPath={breadcrumbPath}
              reviewInfo={{
                lastReviewText,
                historyCorrectRate,
                reviewCount,
              }}
              onFlip={flipCard}
              isAnimating={isAnimating}
            />
          }
          back={
            <CardBack
              answer={point?.answer ?? ""}
              breadcrumbPath={breadcrumbPath}
              keywords={keywords}
              onToggleKeyword={toggleKeyword}
              interactive={!isAnimating && !aiResult}
            />
          }
        />
      </div>

      {/* AI 判分区域（论述题 + 翻转后） */}
      {isFlipped && aiMode && !aiResult && (
        <div className="flex-shrink-0 px-5 pb-2">
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="在此输入你的完整答案…"
            className="w-full min-h-[100px] bg-gray-50 border border-divider rounded-card px-4 py-3 text-body text-text-primary resize-none focus:outline-none focus:border-brand-blue"
            disabled={isAnimating || isAiScoring}
          />
          <button
            onClick={submitForAiScoring}
            disabled={isAiScoring || !userAnswer.trim()}
            className="w-full h-[44px] bg-brand-blue text-text-inverse rounded-button text-btn-text mt-2 disabled:opacity-50"
          >
            {isAiScoring ? "AI 判分中…" : "提交答案 →"}
          </button>
        </div>
      )}

      {/* AI 判分结果 */}
      {aiResult && (
        <div className="flex-shrink-0 px-5 pb-2">
          <div className="bg-white border border-divider rounded-card px-4 py-3">
            <p className="text-section-title text-text-primary text-center">
              {aiResult.score} 分
            </p>
            <div className="mt-2 space-y-1 text-caption">
              <p className="text-semantic-success">
                ✅ 已覆盖：{aiResult.covered.join("、") || "无"}
              </p>
              <p className="text-semantic-danger">
                ❌ 遗漏：{aiResult.missing.join("、") || "无"}
              </p>
              {aiResult.suggestion && (
                <p className="text-text-secondary mt-1">💡 {aiResult.suggestion}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 评分区域 */}
      <div className="flex-shrink-0 px-5 pb-4">
        {isFlipped && !aiMode && (
          <RatingButtons onRate={rateCard} disabled={isAnimating} />
        )}
        {aiResult && (
          <div className="mt-2">
            <p className="text-caption text-text-secondary text-center mb-2 select-none">
              综合 AI 判分和你的判断：
            </p>
            <RatingButtons onRate={rateCard} disabled={isAnimating} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * LearnSession — 单张卡片学习循环
 */

import { useMemo } from "react";
import { useLearnStore } from "@/stores/learnStore";
import { useDomainStore } from "@/stores/domainStore";
import { FlipCard } from "@/components/card/FlipCard";
import { CardFront } from "@/components/card/CardFront";
import { CardBack } from "@/components/card/CardBack";
import { RatingButtons } from "@/components/rating/RatingButtons";

export function LearnSession() {
  const currentCard = useLearnStore((s) => s.currentCard);
  const currentPoint = useLearnStore((s) => s.currentPoint);
  const isFlipped = useLearnStore((s) => s.isFlipped);
  const isAnimating = useLearnStore((s) => s.isAnimating);
  const keywords = useLearnStore((s) => s.keywords);
  const flipCard = useLearnStore((s) => s.flipCard);
  const toggleKeyword = useLearnStore((s) => s.toggleKeyword);
  const rateCard = useLearnStore((s) => s.rateCard);

  const domainMap = useDomainStore((s) => s.domainMap);

  // ── 从 treePath（ID 数组）构建面包屑名称数组 ──
  const breadcrumbPath = useMemo(() => {
    if (!currentPoint?.treePath) return currentPoint ? [currentPoint.title] : [];
    return currentPoint.treePath
      .map((id) => domainMap[id]?.name)
      .filter((name): name is string => Boolean(name));
  }, [currentPoint, domainMap]);

  if (!currentCard || !currentPoint) return null;

  return (
    <div className="flex flex-col h-full">
      {/* 卡片区域 */}
      <div className="flex-1 flex items-start pt-4 px-5">
        <FlipCard
          isFlipped={isFlipped}
          front={
            <CardFront
              question={currentPoint.question}
              breadcrumbPath={breadcrumbPath}
              onFlip={flipCard}
              isAnimating={isAnimating}
            />
          }
          back={
            <CardBack
              answer={currentPoint.answer}
              breadcrumbPath={breadcrumbPath}
              keywords={keywords}
              onToggleKeyword={toggleKeyword}
              interactive={!isAnimating}
            />
          }
        />
      </div>

      {/* 评分区域 — 仅翻转后显示 */}
      <div className="flex-shrink-0 px-5 pb-4">
        {isFlipped && (
          <RatingButtons onRate={rateCard} disabled={isAnimating} />
        )}
      </div>
    </div>
  );
}

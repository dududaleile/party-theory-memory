/**
 * 易混概念区块
 *
 * 横向滑动展示对比卡片对。
 * 每对卡片并排展示，下方有 AI 生成的区分要点。
 */

import { useFocusStore } from "@/stores/focusStore";
import { useDomainStore } from "@/stores/domainStore";

export function ConfusingPairSection() {
  const pairs = useFocusStore((s) => s.confusingPairs);
  const currentIndex = useFocusStore((s) => s.currentPairIndex);
  const setCurrentPairIndex = useFocusStore((s) => s.setCurrentPairIndex);
  const points = useDomainStore((s) => s.points);

  if (pairs.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card px-5 py-6 mb-6">
        <h3 className="text-section-title text-text-primary mb-3">⚠️ 易混概念</h3>
        <p className="text-caption text-text-tertiary text-center py-4">
          暂未发现易混概念
        </p>
        <p className="text-label text-text-tertiary text-center">
          当你的知识库中有足够多的知识点后，系统会自动识别易混淆的概念对
        </p>
      </div>
    );
  }

  const pair = pairs[currentIndex];
  const pointA = points.find((p) => p.id === pair.pointAId);
  const pointB = points.find((p) => p.id === pair.pointBId);

  return (
    <div className="bg-white rounded-card shadow-card px-5 py-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title text-text-primary">
          ⚠️ 易混概念
        </h3>
        <span className="text-caption text-text-tertiary">
          {currentIndex + 1} / {pairs.length} 组
        </span>
      </div>

      {/* 对比卡片 */}
      <div className="flex flex-col gap-3 mb-4">
        {/* A */}
        <div className="border-l-[3px] border-brand-blue pl-3 py-2 bg-blue-50/50 rounded-r-tag">
          <p className="text-label text-brand-blue mb-1">概念 A</p>
          <p className="text-body text-text-primary font-medium">
            {pointA?.title ?? pair.pointAId}
          </p>
          <p className="text-caption text-text-secondary mt-1 line-clamp-3">
            {pointA?.answerBrief ?? pointA?.answer?.slice(0, 80) ?? ""}
          </p>
        </div>

        {/* 闪电分隔 */}
        <div className="text-center text-text-tertiary text-label">⚡ 容易混淆 ⚡</div>

        {/* B */}
        <div className="border-l-[3px] border-semantic-warning pl-3 py-2 bg-orange-50/50 rounded-r-tag">
          <p className="text-label text-semantic-warning mb-1">概念 B</p>
          <p className="text-body text-text-primary font-medium">
            {pointB?.title ?? pair.pointBId}
          </p>
          <p className="text-caption text-text-secondary mt-1 line-clamp-3">
            {pointB?.answerBrief ?? pointB?.answer?.slice(0, 80) ?? ""}
          </p>
        </div>
      </div>

      {/* 区分要点 */}
      {pair.distinction && (
        <div className="bg-highlight-bg rounded-tag px-3 py-2.5 mb-3">
          <p className="text-label text-text-primary mb-1">💡 区分要点</p>
          <p className="text-caption text-text-secondary">{pair.distinction}</p>
        </div>
      )}

      {/* 记忆技巧 */}
      {pair.mnemonic && (
        <div className="bg-green-50 rounded-tag px-3 py-2 mb-3">
          <p className="text-label text-semantic-success mb-1">🧠 记忆技巧</p>
          <p className="text-caption text-text-secondary">{pair.mnemonic}</p>
        </div>
      )}

      {/* 导航 */}
      {pairs.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {pairs.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPairIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? "bg-brand-blue w-4" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

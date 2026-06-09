/**
 * 学习页
 *
 * 三种状态：
 *   1. 无会话 → 显示开始按钮
 *   2. 学习会话中 → LearnSession（卡片翻转）
 *   3. 会话完成 → LearnComplete（统计画面）
 */

import { useEffect } from "react";
import { useLearnStore } from "@/stores/learnStore";
import { useDomainStore } from "@/stores/domainStore";
import { LearnSession } from "./LearnSession";
import { LearnComplete } from "./LearnComplete";

export function LearnPage() {
  const isActive = useLearnStore((s) => s.isActive);
  const sessionStats = useLearnStore((s) => s.sessionStats);
  const startSession = useLearnStore((s) => s.startSession);
  const currentIndex = useLearnStore((s) => s.currentIndex);

  const isLoaded = useDomainStore((s) => s.isLoaded);
  const loadAll = useDomainStore((s) => s.loadAll);

  // 确保领域数据已加载（面包屑需要）
  useEffect(() => {
    if (!isLoaded) loadAll();
  }, [isLoaded, loadAll]);

  // 判断是否完成（会话非活跃但有过统计 = 刚完成）
  const isComplete = !isActive && sessionStats.completed > 0;

  // ── 状态 3：完成画面 ──
  if (isComplete) {
    return <LearnComplete />;
  }

  // ── 状态 2：学习会话中 ──
  if (isActive) {
    return (
      <div className="flex flex-col h-full">
        {/* 顶栏：返回 + 进度 */}
        <div className="flex-shrink-0 px-5 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => useLearnStore.getState().endSession()}
              className="text-body text-brand-blue tap-active"
            >
              ← 返回
            </button>
            <span className="text-caption text-text-secondary select-none">
              学习新知识
            </span>
            <span className="text-caption text-text-tertiary select-none">
              {currentIndex + 1} / {sessionStats.total}
            </span>
          </div>

          {/* 细进度条 */}
          <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-blue rounded-full transition-all duration-500"
              style={{
                width: `${sessionStats.total > 0
                  ? ((sessionStats.completed) / sessionStats.total) * 100
                  : 0}%`,
              }}
            />
          </div>
        </div>

        {/* 卡片区域 */}
        <div className="flex-1 min-h-0">
          <LearnSession />
        </div>
      </div>
    );
  }

  // ── 状态 1：无会话 — 开始学习入口 ──
  return (
    <div className="scroll-container flex items-center justify-center">
      <div className="text-center px-5 w-full max-w-[320px]">
        <span className="text-5xl block mb-4 select-none">📖</span>
        <h2 className="text-section-title text-text-primary mb-2">学习新知识</h2>
        <p className="text-caption text-text-secondary mb-6">
          按知识树结构学习，先建框架，再学细节
        </p>
        <button
          onClick={() => startSession("all")}
          className="w-full h-[48px] bg-brand-blue text-text-inverse rounded-button text-btn-text tap-active shadow-button"
        >
          开始学习 →
        </button>
      </div>
    </div>
  );
}

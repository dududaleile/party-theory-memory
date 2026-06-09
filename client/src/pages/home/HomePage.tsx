import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useDomainStore } from "@/stores/domainStore";
import { RingProgress } from "@/components/progress/RingProgress";
import {
  getDueCards,
  getNewCards,
  getTodayReviewCount,
  getStudyStreakDays,
  getRetentionRate,
} from "@/db/cards";

/**
 * 首页
 *
 * 数据来源：domainStore（领域列表 + 掌握度）+ cardDb（今日统计）
 * 智能分流：有待复习 → 复习页，否则 → 学习页
 */
export function HomePage() {
  const setTab = useUIStore((s) => s.setTab);

  // ── 领域数据 ──
  const {
    domainTree,
    isLoaded,
    isLoading,
    loadAll,
  } = useDomainStore();

  // ── 首页统计（直接从 IndexedDB 查询）──
  const [stats, setStats] = useState<{
    dueCardsCount: number;
    newCardsCount: number;
    studyStreak: number;
    retentionRate: number;
  }>({
    dueCardsCount: 0,
    newCardsCount: 0,
    studyStreak: 0,
    retentionRate: 100,
  });

  // ── 初始化加载 ──
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── 刷新统计 ──
  useEffect(() => {
    if (!isLoaded) return;
    refreshStats();
  }, [isLoaded]);

  async function refreshStats() {
    const [due, newCards, streak, rate] = await Promise.all([
      getDueCards(),
      getNewCards(),
      getStudyStreakDays(),
      getRetentionRate(),
    ]);
    setStats({
      dueCardsCount: due.length,
      newCardsCount: newCards.length,
      studyStreak: streak,
      retentionRate: rate,
    });
  }

  // ── 智能分流 ──
  function handleStartLearning() {
    if (stats.dueCardsCount > 0) {
      setTab("review");
    } else if (stats.newCardsCount > 0) {
      setTab("learn");
    } else {
      setTab("focus");
    }
  }

  function handleDomainClick(_domainId: string) {
    // 进入该领域的专属学习（后续实现领域筛选参数）
    setTab("learn");
  }

  // ── 加载态 ──
  if (isLoading) {
    return (
      <div className="scroll-container flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-caption text-text-secondary">加载中…</p>
        </div>
      </div>
    );
  }

  const hasDueCards = stats.dueCardsCount > 0;

  return (
    <div className="scroll-container">
      <div className="flex flex-col items-center px-5 pt-8 pb-8">
        {/* ── 页面标题 ── */}
        <h1 className="text-page-title text-text-primary mb-8 select-none">
          🏛 理论记忆
        </h1>

        {/* ── 状态卡片组 ── */}
        <div className="w-full mb-6">
          {/* 主状态卡片 */}
          <div
            className={`
              bg-white rounded-card shadow-card px-5 py-6 mb-3
              flex flex-col items-center
              ${hasDueCards ? "cursor-pointer tap-active" : ""}
            `}
            onClick={() => hasDueCards && setTab("review")}
          >
            {hasDueCards ? (
              <>
                <span className="text-stat-number text-semantic-danger select-none">
                  {stats.dueCardsCount}
                </span>
                <span className="text-caption text-text-secondary mt-1">
                  今日待复习 · 张卡片
                </span>
              </>
            ) : (
              <>
                <span className="text-[40px] leading-none text-semantic-success select-none">
                  ✓
                </span>
                <span className="text-card-title text-text-secondary mt-2">
                  全部掌握
                </span>
                <span className="text-caption text-text-tertiary mt-0.5">
                  今日无待复习
                </span>
              </>
            )}
          </div>

          {/* 副状态卡片 */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-card shadow-card px-4 py-4 flex flex-col items-center">
              <span className="text-section-title text-text-primary select-none">
                {stats.studyStreak}
              </span>
              <span className="text-caption text-text-secondary mt-1">
                持续学习
              </span>
            </div>
            <div className="flex-1 bg-white rounded-card shadow-card px-4 py-4 flex flex-col items-center">
              <span className="text-section-title text-brand-blue select-none">
                {stats.retentionRate}%
              </span>
              <span className="text-caption text-text-secondary mt-1">
                记忆保持率
              </span>
            </div>
          </div>
        </div>

        {/* ── 主按钮 ── */}
        <button
          onClick={handleStartLearning}
          className="
            w-full h-[48px] bg-brand-blue text-text-inverse
            rounded-button text-btn-text tap-active shadow-button mb-8
          "
        >
          {hasDueCards
            ? "开始复习 →"
            : stats.newCardsCount > 0
              ? "学习新知识 →"
              : "重点强化 →"}
        </button>

        {/* ── 知识领域列表 ── */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-section-title text-text-primary">知识领域</span>
            <span className="text-caption text-text-tertiary">
              {domainTree.length} 个领域
            </span>
          </div>

          {domainTree.length === 0 ? (
            <div className="bg-white rounded-card shadow-card px-5 py-8 text-center">
              <span className="text-3xl block mb-3">📋</span>
              <p className="text-body text-text-secondary mb-1">
                还没有知识卡片
              </p>
              <p className="text-caption text-text-tertiary mb-4">
                在设置页导入党课知识，开始记忆之旅
              </p>
              <button
                onClick={() => setTab("settings")}
                className="text-brand-blue text-btn-text tap-active"
              >
                前往设置 →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {domainTree.map((node) => {
                const pct = node.mastery.percentage;

                return (
                  <button
                    key={node.domain.id}
                    onClick={() => handleDomainClick(node.domain.id)}
                    className="
                      flex items-center gap-3
                      bg-white rounded-card shadow-card
                      px-4 py-3 tap-active
                      w-full text-left
                    "
                  >
                    <RingProgress percentage={pct} size={28} />

                    <span className="flex-1 text-body text-text-primary select-none truncate">
                      {node.domain.name}
                    </span>

                    <span
                      className={`text-caption font-semibold mr-1 ${
                        pct >= 90 ? "text-semantic-success" :
                        pct >= 70 ? "text-brand-blue" :
                        pct >= 40 ? "text-semantic-warning" :
                        "text-semantic-danger"
                      }`}
                    >
                      {pct}%
                    </span>
                    <span className="text-text-tertiary text-body">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

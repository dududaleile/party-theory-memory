/**
 * 学习完成画面
 */

import { useLearnStore } from "@/stores/learnStore";
import { useUIStore } from "@/stores/uiStore";

export function LearnComplete() {
  const sessionStats = useLearnStore((s) => s.sessionStats);
  const endSession = useLearnStore((s) => s.endSession);
  const setTab = useUIStore((s) => s.setTab);

  const { completed, ratings } = sessionStats;
  const mastered = ratings[5] || 0;
  const remembered = ratings[4] || 0;
  const blurry = ratings[2] || 0;
  const forgotten = ratings[0] || 0;

  return (
    <div className="scroll-container">
      <div className="flex flex-col items-center px-5 pt-16">
        {/* 完成图标 */}
        <span className="text-6xl mb-6 select-none">🎉</span>

        <h2 className="text-page-title text-text-primary mb-6">今日学习完成</h2>

        {/* 统计卡片 */}
        <div className="w-full bg-white rounded-card shadow-card px-5 py-5 mb-6">
          <p className="text-body text-text-primary mb-4 text-center">
            学习 {completed} 张卡片
          </p>

          <div className="space-y-2">
            <StatRow icon="🌟" label="完全掌握" count={mastered} color="text-semantic-success" />
            <StatRow icon="✓"  label="基本记住" count={remembered} color="text-brand-blue" />
            <StatRow icon="🤔" label="模糊"     count={blurry}    color="text-semantic-warning" />
            <StatRow icon="❌" label="完全忘记" count={forgotten} color="text-semantic-danger" />
          </div>

          <p className="text-caption text-text-tertiary text-center mt-4">
            首次复习提醒：5 分钟后
          </p>
        </div>

        {/* 操作按钮 */}
        <button
          onClick={() => { endSession(); setTab("home"); }}
          className="w-full h-[48px] bg-brand-blue text-text-inverse rounded-button text-btn-text tap-active mb-3"
        >
          回到首页
        </button>

        <button
          onClick={() => { endSession(); setTab("review"); }}
          className="w-full h-[48px] bg-white text-brand-blue border border-brand-blue rounded-button text-btn-text tap-active"
        >
          去复习
        </button>
      </div>
    </div>
  );
}

function StatRow({
  icon, label, count, color,
}: {
  icon: string; label: string; count: number; color: string;
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <span className="text-body text-text-secondary">
        {icon} {label}
      </span>
      <span className={`text-card-title font-semibold ${color}`}>
        {count} 张
      </span>
    </div>
  );
}

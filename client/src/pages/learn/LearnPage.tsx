import { useEffect } from "react";
import { useLearnStore } from "@/stores/learnStore";
import { useDomainStore } from "@/stores/domainStore";
import { LearnSession } from "./LearnSession";

export function LearnPage({ onBack }: { onBack: () => void }) {
  const isActive = useLearnStore((s) => s.isActive);
  const sessionStats = useLearnStore((s) => s.sessionStats);
  const startSession = useLearnStore((s) => s.startSession);
  const endSession = useLearnStore((s) => s.endSession);
  const currentIndex = useLearnStore((s) => s.currentIndex);
  const isLoaded = useDomainStore((s) => s.isLoaded);
  const loadAll = useDomainStore((s) => s.loadAll);

  useEffect(() => { if (!isLoaded) loadAll(); }, [isLoaded, loadAll]);

  const isComplete = !isActive && sessionStats.completed > 0;

  if (isComplete) {
    const mastered = sessionStats.ratings[5] || 0;
    const remembered = sessionStats.ratings[4] || 0;
    const totalGood = mastered + remembered;
    const rate = sessionStats.completed > 0 ? Math.round((totalGood / sessionStats.completed) * 100) : 0;

    // 超量鼓励语
    const encoreMessages = [
      "太猛了！再来一轮？",
      "根本停不下来！💪",
      "你是记忆机器吗？继续！",
      "这劲头谁都拦不住！🔥",
      "已经超量了，但谁在乎呢？",
      "学习上瘾，好事啊！",
      "刷完这轮你就是党课王者！",
    ];

    return (
      <div className="scroll-container">
        <div className="flex flex-col items-center px-5 pt-12">
          <span className="text-6xl mb-3">{rate >= 90 ? "🏆" : rate >= 70 ? "🎉" : "💪"}</span>
          <h2 className="text-page-title mb-2">
            {sessionStats.completed >= 20
              ? encoreMessages[Math.floor(Math.random() * encoreMessages.length)]
              : "本轮完成"}
          </h2>

          <div className="w-full bg-white rounded-card shadow-card px-5 py-5 mb-4 text-center">
            <p className="text-body text-text-secondary">
              学了 <span className="text-section-title text-text-primary">{sessionStats.completed}</span> 张
            </p>
            <div className="flex justify-center gap-4 mt-2 text-caption">
              <span className="text-semantic-success">🌟 {mastered}</span>
              <span className="text-brand-blue">✓ {remembered}</span>
              <span className="text-semantic-warning">🤔 {sessionStats.ratings[2] || 0}</span>
              <span className="text-semantic-danger">❌ {sessionStats.ratings[0] || 0}</span>
            </div>
            <p className="text-caption text-text-secondary mt-2">掌握率 {rate}%</p>
          </div>

          {sessionStats.completed >= 10 && (
            <div className="w-full bg-brand-blue/5 border border-brand-blue/20 rounded-card px-4 py-3 mb-4 text-center">
              <p className="text-body text-brand-blue font-semibold">
                {sessionStats.completed >= 30 ? "🏅 你今天已经远超常人！" :
                 sessionStats.completed >= 20 ? "🔥 超量学习，记忆效果翻倍！" :
                 "⚡ 超额完成，多学多记！"}
              </p>
            </div>
          )}

          <button onClick={() => startSession("all")} className="w-full h-[48px] bg-brand-blue text-white rounded-button text-btn-text tap-active mb-3">
            继续学习 →
          </button>
          <button onClick={() => { endSession(); onBack(); }} className="w-full h-[48px] bg-white text-text-secondary border border-divider rounded-button text-btn-text tap-active">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-5 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => endSession()} className="text-body text-brand-blue tap-active">← 返回</button>
            <span className="text-caption text-text-secondary">{currentIndex + 1} / {sessionStats.total}</span>
          </div>
          <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue rounded-full transition-all duration-500" style={{ width: `${sessionStats.total > 0 ? (sessionStats.completed / sessionStats.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex-1 min-h-0"><LearnSession /></div>
      </div>
    );
  }

  return (
    <div className="scroll-container flex items-center justify-center">
      <div className="text-center px-5">
        <span className="text-5xl block mb-4">📖</span>
        <h2 className="text-section-title mb-2">学习新知识</h2>
        <p className="text-caption text-text-secondary mb-6">按知识树顺序，先框架后细节</p>
        <button onClick={() => startSession("all")} className="w-full h-[48px] bg-brand-blue text-white rounded-button text-btn-text tap-active">开始学习 →</button>
      </div>
    </div>
  );
}

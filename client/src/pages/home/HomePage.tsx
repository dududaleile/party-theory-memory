import { useEffect } from "react";
import { useDomainStore } from "@/stores/domainStore";
import { getDueCards, getStudyStreakDays, getRetentionRate } from "@/db/cards";
import { useState } from "react";

export function HomePage({ onStart }: { onStart: () => void }) {
  const { domainTree, isLoaded, loadAll } = useDomainStore();
  const [stats, setStats] = useState({ due: 0, streak: 0, rate: 100 });

  useEffect(() => { if (!isLoaded) loadAll(); }, [isLoaded, loadAll]);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      const [due, streak, rate] = await Promise.all([getDueCards(), getStudyStreakDays(), getRetentionRate()]);
      setStats({ due: due.length, streak, rate });
    })();
  }, [isLoaded]);

  return (
    <div className="scroll-container">
      <div className="flex flex-col items-center px-5 pt-12 pb-8">
        <h1 className="text-page-title mb-6">🏛 理论记忆</h1>

        {stats.due > 0 ? (
          <div className="bg-white rounded-card shadow-card px-5 py-6 mb-4 w-full text-center cursor-pointer tap-active" onClick={onStart}>
            <span className="text-stat-number text-semantic-danger">{stats.due}</span>
            <p className="text-caption text-text-secondary mt-1">张卡片待复习</p>
          </div>
        ) : (
          <div className="bg-white rounded-card shadow-card px-5 py-6 mb-4 w-full text-center">
            <span className="text-[40px] text-semantic-success">✓</span>
            <p className="text-caption text-text-secondary mt-1">全部掌握</p>
          </div>
        )}

        <div className="flex gap-3 w-full mb-6">
          <div className="flex-1 bg-white rounded-card shadow-card px-4 py-3 text-center">
            <span className="text-section-title">{stats.streak}</span>
            <p className="text-caption text-text-secondary">学习天数</p>
          </div>
          <div className="flex-1 bg-white rounded-card shadow-card px-4 py-3 text-center">
            <span className="text-section-title text-brand-blue">{stats.rate}%</span>
            <p className="text-caption text-text-secondary">保持率</p>
          </div>
        </div>

        <button onClick={onStart} className="w-full h-[48px] bg-brand-blue text-white rounded-button text-btn-text tap-active shadow-button mb-6">
          {stats.due > 0 ? "开始复习 →" : "开始学习 →"}
        </button>

        {domainTree.length > 0 && (
          <div className="w-full">
            <p className="text-section-title mb-3">知识领域</p>
            {domainTree.map(n => {
              const pct = n.mastery.percentage;
              return (
                <div key={n.domain.id} className="flex items-center gap-3 bg-white rounded-card shadow-card px-4 py-3 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-label text-white ${pct >= 90 ? "bg-semantic-success" : pct >= 40 ? "bg-brand-blue" : "bg-semantic-warning"}`}>
                    {pct}%
                  </div>
                  <span className="text-body truncate flex-1">{n.domain.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

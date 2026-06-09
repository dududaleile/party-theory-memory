import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDomainStore } from "@/stores/domainStore";

export function SettingsPage() {
  const store = useSettingsStore();
  const domainLoaded = useDomainStore((s) => s.isLoaded);
  const loadDomains = useDomainStore((s) => s.loadAll);

  useEffect(() => { store.loadSettings(); if (!domainLoaded) loadDomains(); }, []);

  return (
    <div className="scroll-container">
      <div className="px-5 pt-8 pb-8">
        <h1 className="text-page-title mb-6">设置</h1>

        {/* 学习偏好 */}
        <div className="bg-white rounded-card shadow-card px-5 py-5 mb-4">
          <h3 className="text-card-title mb-3">⚙️ 学习偏好</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary">每日新卡片数</span>
            <Stepper value={store.dailyNewCardLimit} onChange={v => store.updateSetting("dailyNewCardLimit", v)} min={5} max={100} step={5} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary">每日复习上限</span>
            <Stepper value={store.dailyReviewLimit} onChange={v => store.updateSetting("dailyReviewLimit", v)} min={10} max={200} step={10} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary">提醒时间</span>
            <input type="time" value={store.reminderTime} onChange={e => store.updateSetting("reminderTime", e.target.value)}
              className="bg-gray-50 border border-divider rounded-button px-3 py-1.5 text-body" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary">每日提醒</span>
            <Toggle checked={store.reminderEnabled} onChange={v => store.updateSetting("reminderEnabled", v)} />
          </div>
        </div>

        {/* 数据统计 */}
        <div className="bg-white rounded-card shadow-card px-5 py-5 mb-4">
          <h3 className="text-card-title mb-3">📊 数据统计</h3>
          <StatRow label="总知识点" value={store.totalPoints} />
          <StatRow label="总卡片" value={store.totalCards} />
          <StatRow label="已掌握" value={`${store.masteredCards} (${store.totalCards > 0 ? Math.round(store.masteredCards / store.totalCards * 100) : 0}%)`} />
          <StatRow label="累计复习" value={`${store.totalReviews} 次`} />
          <StatRow label="学习天数" value={`${store.totalStudyDays} 天`} />
          {store.domainStats.map(d => (
            <div key={d.name} className="flex items-center justify-between mt-2">
              <span className="text-caption text-text-secondary truncate flex-1 mr-2">{d.name}</span>
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${d.percentage >= 90 ? "bg-semantic-success" : d.percentage >= 70 ? "bg-brand-blue" : "bg-semantic-warning"}`} style={{ width: `${d.percentage}%` }} />
              </div>
              <span className="text-label text-text-tertiary ml-2 w-8 text-right">{d.percentage}%</span>
            </div>
          ))}
        </div>

        {/* 清空 */}
        <div className="text-center">
          <ClearDataButton />
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="flex items-center rounded-button overflow-hidden border border-divider">
      <button onClick={() => onChange(Math.max(min, value - step))} className="w-[32px] h-[32px] bg-gray-50 text-text-secondary tap-active">−</button>
      <span className="w-[40px] text-center text-body font-medium">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="w-[32px] h-[32px] bg-gray-50 text-text-secondary tap-active">+</button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-[44px] h-[26px] rounded-full transition-colors ${checked ? "bg-semantic-success" : "bg-gray-300"}`}>
      <div className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow transition-transform ${checked ? "translate-x-[20px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between py-1.5"><span className="text-caption text-text-secondary">{label}</span><span className="text-body font-medium">{value}</span></div>;
}

function ClearDataButton() {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button onClick={() => setConfirm(true)} className="text-caption text-semantic-danger tap-active">清空所有学习数据</button>;
  return (
    <div className="bg-red-50 rounded-tag px-4 py-3">
      <p className="text-caption text-semantic-danger mb-2">确认清空？不可恢复。</p>
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)} className="flex-1 h-[32px] bg-gray-200 text-text-secondary rounded-button text-caption">取消</button>
        <button onClick={async () => {
          const { db } = await import("@/db/schema");
          await Promise.all([db.knowledgeDomains.clear(), db.knowledgePoints.clear(), db.memoryCards.clear(), db.reviewLogs.clear()]);
          setConfirm(false);
          window.location.reload();
        }} className="flex-1 h-[32px] bg-semantic-danger text-white rounded-button text-caption">确认清空</button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useDomainStore } from "@/stores/domainStore";
import { useReviewStore } from "@/stores/reviewStore";
import { useFocusStore } from "@/stores/focusStore";
import { HomePage } from "@/pages/home/HomePage";
import { LearnPage } from "@/pages/learn/LearnPage";
import { ReviewPage } from "@/pages/review/ReviewPage";
import { FocusPage } from "@/pages/focus/FocusPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { IMPORT_DATA } from "@/data/importData";

type Page = "home" | "learn" | "review" | "focus" | "settings";

const TABS: { key: Page; label: string; icon: string }[] = [
  { key: "home", label: "首页", icon: "🏠" },
  { key: "learn", label: "学习", icon: "📖" },
  { key: "review", label: "复习", icon: "🔄" },
  { key: "focus", label: "强化", icon: "🎯" },
  { key: "settings", label: "设置", icon: "⚙️" },
];

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = useDomainStore.getState();
        await s.loadAll();
        if (s.domainTree.length === 0) {
          await s.directImport(IMPORT_DATA.domains as any, IMPORT_DATA.points as any, IMPORT_DATA.cards as any);
        }
      } catch { /* ok */ }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <div className="h-full flex items-center justify-center bg-bg-page"><p className="text-text-secondary text-caption">加载中…</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-bg-page">
      <div className="flex-1 min-h-0 overflow-hidden">
        {page === "home" && <HomePage onStart={() => setPage(useReviewStore.getState().queue.length > 0 ? "review" : "learn")} />}
        {page === "learn" && <LearnPage onBack={() => setPage("home")} />}
        {page === "review" && <ReviewPage />}
        {page === "focus" && <FocusPage />}
        {page === "settings" && <SettingsPage />}
      </div>
      <nav className="flex-shrink-0 bg-white border-t border-divider" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex h-[56px] items-center justify-around">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setPage(t.key)} className={`flex flex-col items-center gap-0.5 min-w-[48px] h-full px-1 ${page === t.key ? "text-brand-blue" : "text-text-tertiary"}`}>
              <span className="text-xl">{t.icon}</span>
              <span className={`text-label ${page === t.key ? "font-semibold" : ""}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

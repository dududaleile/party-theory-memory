import { useUIStore } from "@/stores/uiStore";
import { TabBar } from "@/components/navigation/TabBar";
import { HomePage } from "@/pages/home/HomePage";
import { LearnPage } from "@/pages/learn/LearnPage";
import { ReviewPage } from "@/pages/review/ReviewPage";
import { FocusPage } from "@/pages/focus/FocusPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

const PAGES: Record<string, React.ComponentType> = {
  home: HomePage,
  learn: LearnPage,
  review: ReviewPage,
  focus: FocusPage,
  settings: SettingsPage,
};

export function App() {
  const currentTab = useUIStore((s) => s.currentTab);
  const PageComponent = PAGES[currentTab] || HomePage;

  return (
    <div className="h-full flex flex-col bg-bg-page">
      {/* 页面内容区 — 仅渲染当前 Tab */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PageComponent key={currentTab} />
      </div>

      {/* 底部导航 */}
      <TabBar />
    </div>
  );
}

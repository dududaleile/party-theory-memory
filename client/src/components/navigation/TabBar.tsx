import { useUIStore, type TabName } from "@/stores/uiStore";

interface TabItem {
  key: TabName;
  label: string;
  icon: string; // SF Symbol 风格 emoji
  activeIcon: string;
}

const tabs: TabItem[] = [
  { key: "home", label: "首页", icon: "🏠", activeIcon: "🏠" },
  { key: "learn", label: "学习", icon: "📖", activeIcon: "📖" },
  { key: "review", label: "复习", icon: "🔄", activeIcon: "🔄" },
  { key: "focus", label: "强化", icon: "🎯", activeIcon: "🎯" },
  { key: "settings", label: "设置", icon: "⚙️", activeIcon: "⚙️" },
];

export function TabBar() {
  const currentTab = useUIStore((s) => s.currentTab);
  const setTab = useUIStore((s) => s.setTab);

  return (
    <nav
      className="flex-shrink-0 bg-white border-t border-divider pb-safe"
      style={{ height: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex h-[56px] items-center justify-around px-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`
                flex flex-col items-center justify-center gap-0.5
                min-w-[48px] h-full px-2
                transition-colors duration-150
                ${isActive ? "text-brand-blue" : "text-text-tertiary"}
              `}
            >
              {/* 图标 */}
              <span className="text-xl leading-none select-none">
                {isActive ? tab.activeIcon : tab.icon}
              </span>
              {/* 文字 */}
              <span
                className={`
                  text-label select-none
                  ${isActive ? "font-semibold" : "font-normal"}
                `}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

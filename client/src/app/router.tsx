import { Navigate } from "react-router-dom";
import { HomePage } from "@/pages/home/HomePage";
import { LearnPage } from "@/pages/learn/LearnPage";
import { ReviewPage } from "@/pages/review/ReviewPage";
import { FocusPage } from "@/pages/focus/FocusPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

/**
 * 路由配置
 *
 * 设计决策：
 * - 不使用 createBrowserRouter + <Outlet> 的嵌套路由
 * - 使用简单的路径→组件映射，由 App.tsx 根据 useUIStore.currentTab 决定显示哪个页面
 * - 原因：Tab Bar 导航不需要 URL 路径切换（SPA 内 Tab 切换不是页面跳转）
 * - 但保留 React Router 用于未来的深层导航（如 /settings/import）
 */
export const pageMap: Record<string, React.ComponentType> = {
  home: HomePage,
  learn: LearnPage,
  review: ReviewPage,
  focus: FocusPage,
  settings: SettingsPage,
};

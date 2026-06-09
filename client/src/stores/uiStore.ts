import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TabName = "home" | "learn" | "review" | "focus" | "settings";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration: number;
}

interface UIStore {
  // ── 导航 ──
  currentTab: TabName;
  setTab: (tab: TabName) => void;

  // ── Toast ──
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  // ── 加载 ──
  isGlobalLoading: boolean;
  loadingMessage: string;
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // ── 导航 ──
      currentTab: "home",
      setTab: (tab) => set({ currentTab: tab }),

      // ── Toast ──
      toasts: [],
      showToast: ({ type, message, duration }) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }));
        if (duration > 0) {
          setTimeout(() => get().dismissToast(id), duration);
        }
      },
      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ── 加载 ──
      isGlobalLoading: false,
      loadingMessage: "",
      setGlobalLoading: (loading, message = "") =>
        set({ isGlobalLoading: loading, loadingMessage: message }),
    }),
    {
      name: "ui-store",
      partialize: (state) => ({ currentTab: state.currentTab }),
    }
  )
);

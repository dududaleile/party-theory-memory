/**
 * 重点强化页
 *
 * 四个区块，按优先级纵向排列：
 *   ① 易混概念 — 直接影响选择题得分
 *   ② 薄弱知识点 — 数据驱动，精准补漏
 *   ③ 论述骨架 — 考试输出准备
 *   ④ 知识图谱 — 全局体系化
 */

import { useEffect } from "react";
import { useFocusStore } from "@/stores/focusStore";
import { useDomainStore } from "@/stores/domainStore";
import { ConfusingPairSection } from "./ConfusingPairSection";
import { WeakPointSection } from "./WeakPointSection";
import { EssaySkeletonSection } from "./EssaySkeletonSection";
import { KnowledgeGraphSection } from "./KnowledgeGraphSection";

export function FocusPage() {
  const isLoaded = useFocusStore((s) => s.isLoaded);
  const loadAll = useFocusStore((s) => s.loadAll);
  const domainLoaded = useDomainStore((s) => s.isLoaded);
  const loadDomains = useDomainStore((s) => s.loadAll);

  useEffect(() => {
    if (!domainLoaded) loadDomains();
  }, [domainLoaded, loadDomains]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!isLoaded) {
    return (
      <div className="scroll-container flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-caption text-text-secondary">加载中…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-container">
      <div className="px-5 pt-6 pb-8">
        <h1 className="text-page-title text-text-primary mb-6 select-none">
          重点强化
        </h1>

        {/* ① 易混概念 — 最高优先级 */}
        <ConfusingPairSection />

        {/* ② 薄弱知识点 */}
        <WeakPointSection />

        {/* ③ 论述骨架 */}
        <EssaySkeletonSection />

        {/* ④ 知识图谱 */}
        <KnowledgeGraphSection />
      </div>
    </div>
  );
}

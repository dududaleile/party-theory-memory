import { useEffect } from "react";
import { useFocusStore } from "@/stores/focusStore";
import { useDomainStore } from "@/stores/domainStore";
import { ConfusingPairSection } from "./ConfusingPairSection";
import { WeakPointSection } from "./WeakPointSection";

export function FocusPage() {
  const isLoaded = useFocusStore((s) => s.isLoaded);
  const loadAll = useFocusStore((s) => s.loadAll);
  const domainLoaded = useDomainStore((s) => s.isLoaded);
  const loadDomains = useDomainStore((s) => s.loadAll);

  useEffect(() => { if (!domainLoaded) loadDomains(); }, [domainLoaded, loadDomains]);
  useEffect(() => { loadAll(); }, [loadAll]);

  if (!isLoaded) {
    return <div className="scroll-container flex items-center justify-center"><p className="text-caption text-text-secondary">加载中…</p></div>;
  }

  return (
    <div className="scroll-container">
      <div className="px-5 pt-6 pb-8">
        <h1 className="text-page-title mb-6">重点强化</h1>
        <ConfusingPairSection />
        <WeakPointSection />
      </div>
    </div>
  );
}

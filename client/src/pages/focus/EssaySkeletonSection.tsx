/**
 * 论述骨架区块
 *
 * 展示 AI 生成的答题骨架列表，点击展开查看完整结构（总-分-总）。
 */

import { useFocusStore } from "@/stores/focusStore";

export function EssaySkeletonSection() {
  const skeletons = useFocusStore((s) => s.essaySkeletons);
  const expandedId = useFocusStore((s) => s.expandedSkeletonId);
  const setExpanded = useFocusStore((s) => s.setExpandedSkeleton);

  if (skeletons.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card px-5 py-6 mb-6">
        <h3 className="text-section-title text-text-primary mb-3">📝 论述骨架</h3>
        <p className="text-caption text-text-tertiary text-center py-4">
          暂无论述骨架
        </p>
        <p className="text-label text-text-tertiary text-center">
          在设置页导入知识后，AI 会为论述题考点生成答题框架
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card px-5 py-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title text-text-primary">
          📝 论述骨架
        </h3>
        <span className="text-caption text-text-tertiary">{skeletons.length} 篇</span>
      </div>

      <div className="flex flex-col gap-3">
        {skeletons.map((sk) => {
          const isExpanded = expandedId === sk.id;

          return (
            <div key={sk.id} className="border border-divider rounded-card overflow-hidden">
              {/* 骨架摘要 */}
              <button
                onClick={() => setExpanded(isExpanded ? null : sk.id)}
                className="w-full px-4 py-3 text-left tap-active"
              >
                <p className="text-body text-text-primary font-medium mb-1">{sk.title}</p>
                <p className="text-caption text-text-secondary line-clamp-2">{sk.thesis}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-label text-text-tertiary">
                    {sk.arguments.length} 个分论点
                  </span>
                  <span className="text-label text-text-tertiary">
                    {sk.keyTerms.length} 个关键术语
                  </span>
                  <span className="text-label text-brand-blue ml-auto">
                    {isExpanded ? "收起 ▲" : "展开骨架 →"}
                  </span>
                </div>
              </button>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="px-4 py-3 border-t border-divider bg-gray-50/50">
                  {/* 总论点 */}
                  <div className="mb-4">
                    <p className="text-label text-text-tertiary mb-1">【总论点】</p>
                    <p className="text-body text-text-primary border-l-[3px] border-brand-blue pl-3">
                      {sk.thesis}
                    </p>
                  </div>

                  {/* 分论点 */}
                  <div className="mb-4">
                    <p className="text-label text-text-tertiary mb-2">【分论点】</p>
                    {sk.arguments.map((arg) => (
                      <div key={arg.order} className="mb-2 pl-3">
                        <p className="text-body text-text-primary font-medium">
                          {arg.order}. {arg.title}
                        </p>
                        <p className="text-caption text-text-secondary mt-0.5">
                          {arg.content}
                        </p>
                        {arg.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {arg.keywords.map((kw) => (
                              <span key={kw} className="text-label bg-gray-100 text-text-secondary px-1.5 py-0.5 rounded-sm">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 结论 */}
                  <div className="mb-3">
                    <p className="text-label text-text-tertiary mb-1">【结论】</p>
                    <p className="text-caption text-text-secondary">{sk.conclusion}</p>
                  </div>

                  {/* 关键术语 */}
                  <div>
                    <p className="text-label text-text-tertiary mb-1">【关键术语】</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sk.keyTerms.map((term) => (
                        <span key={term} className="text-label bg-highlight-bg text-highlight-text px-2 py-0.5 rounded-tag">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

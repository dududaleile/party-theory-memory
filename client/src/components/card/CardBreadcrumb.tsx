/**
 * 卡片面包屑 — 显示当前知识点在知识树中的完整路径
 *
 * 作用：让用户始终知道「我正在知识体系的哪个位置学习」
 * 样式：小字、浅色，不抢焦点
 */

interface CardBreadcrumbProps {
  path: string[];   // 从根领域到当前知识点的路径名称数组
}

export function CardBreadcrumb({ path }: CardBreadcrumbProps) {
  if (!path || path.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1 mb-4 select-none">
      {path.map((name, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && (
            <span className="text-text-tertiary text-label mx-0.5">›</span>
          )}
          <span
            className={`text-label ${
              index === path.length - 1
                ? "text-text-secondary font-medium"
                : "text-text-tertiary"
            }`}
          >
            {name}
          </span>
        </span>
      ))}
    </div>
  );
}

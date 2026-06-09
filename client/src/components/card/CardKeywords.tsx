/**
 * 关键词标签组 — 翻转后展示，用户逐词确认
 *
 * 交互：
 *   未选中：浅灰底 + 灰色文字 + ○
 *   已选中：品牌蓝底 + 白色文字 + ✓
 *   点击切换选中状态
 */

interface CardKeywordsProps {
  keywords: { keyword: string; checked: boolean }[];
  onToggle: (index: number) => void;
  /** 是否允许交互（评分后禁用） */
  interactive?: boolean;
}

export function CardKeywords({ keywords, onToggle, interactive = true }: CardKeywordsProps) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-divider">
      <p className="text-caption text-text-tertiary mb-2 select-none">
        📎 逐词确认你的回忆：
      </p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, index) => (
          <button
            key={index}
            onClick={() => interactive && onToggle(index)}
            disabled={!interactive}
            className={`
              inline-flex items-center gap-1
              px-2.5 py-1 rounded-tag
              text-label transition-colors duration-150
              ${kw.checked
                ? "bg-brand-blue text-white"
                : "bg-gray-100 text-text-secondary hover:bg-gray-200"
              }
              ${interactive ? "cursor-pointer tap-active" : "cursor-default"}
            `}
          >
            <span>{kw.checked ? "✓" : "○"}</span>
            <span>{kw.keyword}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

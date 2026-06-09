/**
 * 卡片背面 — 答案面
 *
 * 展示：完整答案（关键词高亮）+ 关键词标签组（可交互检测）
 * 底部：下次复习时间（仅复习页显示）
 */

import { CardBreadcrumb } from "./CardBreadcrumb";
import { CardKeywords } from "./CardKeywords";

interface CardBackProps {
  answer: string;
  breadcrumbPath: string[];
  keywords: { keyword: string; checked: boolean }[];
  onToggleKeyword: (index: number) => void;
  /** 高亮答案中的关键词 */
  highlightedAnswer?: string;
  /** 复习特有：下次复习时间 */
  nextReviewText?: string;
  interactive?: boolean;
}

export function CardBack({
  answer,
  breadcrumbPath,
  keywords,
  onToggleKeyword,
  nextReviewText,
  interactive = true,
}: CardBackProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 面包屑 */}
      <CardBreadcrumb path={breadcrumbPath} />

      {/* 答案文字 — 可滚动 */}
      <div className="flex-1 overflow-y-auto min-h-[120px] mb-3">
        <p
          className="text-body text-text-primary leading-relaxed whitespace-pre-line"
          dangerouslySetInnerHTML={{
            __html: highlightKeywords(answer, keywords.map((k) => k.keyword)),
          }}
        />
      </div>

      {/* 下次复习提示（仅复习页） */}
      {nextReviewText && (
        <div className="mb-3 px-2 py-1.5 bg-blue-50 rounded-tag">
          <span className="text-label text-brand-blue">
            📅 下次复习：{nextReviewText}
          </span>
        </div>
      )}

      {/* 关键词标签组 */}
      <CardKeywords
        keywords={keywords}
        onToggle={onToggleKeyword}
        interactive={interactive}
      />
    </div>
  );
}

/**
 * 简易关键词高亮（前端实现，不依赖 AI）
 * 将答案文本中与关键词匹配的部分包裹 <mark> 标签
 */
function highlightKeywords(text: string, keywords: string[]): string {
  let result = text;
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    // 转义正则特殊字符
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "g");
    result = result.replace(
      regex,
      '<mark class="bg-highlight-bg text-highlight-text rounded-sm px-0.5">$1</mark>'
    );
  }
  return result;
}

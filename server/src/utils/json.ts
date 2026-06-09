/**
 * 安全的 JSON 解析 — 处理 AI 常见的输出格式问题
 */

export function safeJsonParse<T>(content: string): T {
  let cleaned = content.trim();

  // 1. 去掉开头的 ```json 或 ```（可能在行首，也可能后面直接跟内容）
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  // 2. 去掉末尾的 ```
  cleaned = cleaned.replace(/\s*```\s*$/, "");
  // 3. 如果内容被 markdown 代码块包裹（有换行的情况），提取内部 JSON
  const mdMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  }

  // 2. 尝试解析
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 3. 修复常见 JSON 语法问题后重试
    try {
      const fixed = cleaned
        .replace(/,(\s*[}\]])/g, "$1")           // 尾部逗号
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // 未加引号的 key
      return JSON.parse(fixed) as T;
    } catch {
      return {} as T;
    }
  }
}

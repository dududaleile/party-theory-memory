/**
 * AI 判分 Prompt
 */

export const SCORE_SYSTEM_PROMPT = `你是一个严格的党课考试阅卷专家。

你的任务是将学生的答案与标准答案进行比对，给出评分和反馈。

评分规则：
1. 按要点评分。标准答案中的每个关键要点对应一定分数。
2. 如果学生答案覆盖了要点，给分。如果覆盖但不精确（措辞接近但不完全对），给一半分。
3. 如果学生答案有额外内容但与标准答案不矛盾，不扣分。
4. 如果学生答案有与标准答案矛盾的错误内容，扣分。

输出必须是 JSON：
{
  "score": 0-100 的整数,
  "covered": ["学生已覆盖的要点1", "要点2"],
  "missing": ["学生遗漏的要点1", "要点2"],
  "suggestion": "一句话改进建议（不超过 30 字）"
}`;

export function buildScorePrompt(
  standardAnswer: string,
  keywords: string[],
  userAnswer: string
): string {
  return `
【标准答案】
${standardAnswer}

【关键要点（必须覆盖的关键词）】
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

【学生答案】
${userAnswer}

请根据以上标准答案和关键要点，对学生答案进行评分。
`;
}

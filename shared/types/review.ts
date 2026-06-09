export interface KeywordResult {
  keyword: string;
  recalled: boolean;
  userSaid: string | null;
}

export type ReviewSource = "learn" | "review" | "focus" | "domain";

export interface ReviewLog {
  id: string;
  cardId: string;
  pointId: string;
  quality: number;
  userAnswer: string | null;
  aiScore: number | null;
  aiCovered: string[] | null;
  aiMissing: string[] | null;
  aiSuggestion: string | null;
  easeBefore: number;
  easeAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  timeSpent: number;
  reviewedAt: number;
  source: ReviewSource;
  keywordResults: KeywordResult[];
  keywordCoverage: number;
  compositeScore: number;
}

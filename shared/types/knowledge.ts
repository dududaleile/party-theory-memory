export type QuestionType = "concept" | "list" | "essay" | "compare";

export type RefinementStatus =
  | "draft"
  | "reviewed"
  | "merged"
  | "confirmed"
  | "modified";

export interface KnowledgePoint {
  id: string;
  domainId: string;
  parentPointId: string | null;
  title: string;
  question: string;
  answer: string;
  answerBrief: string;
  keywords: string[];
  difficulty: number;
  questionType: QuestionType;
  tags: string[];
  sourceTextId: string | null;
  sourceTextIndex: number | null;
  sourceTextQuote: string | null;
  treePath: string[];
  refinementRoundId: string | null;
  refinementStatus: RefinementStatus;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

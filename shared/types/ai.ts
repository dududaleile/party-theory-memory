export type ExtractionStatus = "raw" | "extracting" | "extracted" | "reviewed" | "merged" | "confirmed";
export type RefinementRoundType = "extract" | "audit" | "validate" | "structure";
export type RelationType = "parent_child" | "prerequisite" | "related" | "contradicts" | "extends";

export interface SourceText {
  id: string;
  title: string;
  content: string;
  sentences: string[];
  importMethod: "paste" | "file";
  fileName: string | null;
  charCount: number;
  sentenceCount: number;
  extractionStatus: ExtractionStatus;
  extractedPointIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MissedItem {
  sentenceIndex: number;
  content: string;
  reason: string;
  severity: "high" | "medium" | "low";
  suggestion: {
    action: "add" | "merge" | "enrich";
    targetPointTempId: string | null;
    proposedTitle: string;
    proposedQuestion: string;
    proposedAnswer: string;
    proposedKeywords: string[];
    proposedDifficulty: number;
    proposedQuestionType: string;
  };
}

export interface AIRefinementRound {
  id: string;
  sourceTextId: string;
  round: number;
  roundType: RefinementRoundType;
  status: "pending" | "running" | "completed" | "failed";
  modelProvider: string;
  modelName: string;
  promptTemplate: string;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  input: string;
  outputRaw: string;
  outputParsed: object | null;
  missedItems: MissedItem[] | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
  completedAt: number | null;
}

export interface ConfusingPair {
  id: string;
  pointAId: string;
  pointBId: string;
  similarity: string;
  distinction: string;
  mnemonic: string | null;
  confidence: number;
  generatedBy: "ai" | "manual" | "error_driven";
  createdAt: number;
  updatedAt: number;
}

export interface EssayArgument {
  order: number;
  title: string;
  content: string;
  keywords: string[];
  relatedPointIds: string[];
}

export interface EssaySkeleton {
  id: string;
  pointId: string | null;
  title: string;
  thesis: string;
  arguments: EssayArgument[];
  conclusion: string;
  keyTerms: string[];
  modelProvider: string;
  modelName: string;
  generatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeRelation {
  id: string;
  sourcePointId: string;
  targetPointId: string;
  relationType: RelationType;
  strength: number;
  description: string | null;
  generatedBy: "ai" | "manual";
  createdAt: number;
}

export type LearningPhase =
  | "new"
  | "encoding"
  | "consolidating"
  | "retrieving"
  | "mastered";

export interface MemoryCard {
  id: string;
  pointId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number | null;
  lastReview: number | null;
  memoryStrength: number;
  learningPhase: LearningPhase;
  isWeak: boolean;
  weakSince: number | null;
  weakReason: string | null;
  consecutiveCorrect: number;
  consecutiveErrors: number;
  recentRatings: number[];
  totalReviews: number;
  totalCorrect: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * IndexedDB 数据访问层 — 统一导出
 */

export { db } from "./schema";

// domains
export {
  getAllDomains,
  getDomainById,
  getChildDomains,
  getRootDomains,
  getDomainPath,
  addDomain,
  updateDomain,
  deleteDomain,
  recalculateDomainStats,
} from "./domains";

// points
export {
  getAllPoints,
  getPointById,
  getPointsByDomain,
  getPointsByParent,
  getPointsByStatus,
  addPoint,
  updatePoint,
  deletePoint,
  bulkAddPoints,
  bulkUpdatePoints,
} from "./points";

// cards
export {
  getCardById,
  getCardByPointId,
  getDueCards,
  getDueCardsSorted,
  getUpcomingCards,
  getNewCards,
  getNewCardsByDomain,
  getWeakCards,
  getCardsByPhase,
  getTodayReviewCount,
  getStudyStreakDays,
  getRetentionRate,
  addCard,
  updateCard,
  deleteCard,
  bulkAddCards,
  getAllCards,
} from "./cards";

// logs
export {
  getLogsByCard,
  getLogsByPoint,
  getLogsByDateRange,
  addReviewLog,
  getKeywordMissHistory,
  type AddReviewLogInput,
} from "./logs";

// sources
export {
  getSourceById,
  getAllSources,
  addSource,
  updateSourceStatus,
} from "./sources";

// relations
export {
  getRelationsByPoint,
  getAllRelations,
  addRelation,
  deleteRelationsByPoint,
} from "./relations";

// pairs
export {
  getAllPairs,
  getPairsByPoint,
  addPair,
  deletePair,
} from "./pairs";

// skeletons
export {
  getAllSkeletons,
  getSkeletonById,
  getSkeletonsByPoint,
  addSkeleton,
} from "./skeletons";

// settings
export {
  getSetting,
  setSetting,
  getAllSettings,
  deleteSetting,
  getDailyNewCardLimit,
  getDailyReviewLimit,
} from "./settings";

// rounds
export {
  getRoundsBySource,
  addRound,
} from "./rounds";

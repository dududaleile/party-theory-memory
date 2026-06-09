export interface UserSettings {
  key: string;
  value: unknown;
  updatedAt: number;
}

export type SettingsKeys =
  | "aiProvider"
  | "aiModel"
  | "aiBaseUrl"
  | "aiEncryptedKey"
  | "dailyNewCardLimit"
  | "dailyReviewLimit"
  | "reminderTime"
  | "reminderEnabled"
  | "firstLearningIntervals"
  | "theme"
  | "lastBackupDate";

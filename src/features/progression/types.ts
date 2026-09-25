export const rewardEventTypes = [
  "focus_completed",
  "task_completed",
  "achievement_unlocked",
  "challenge_completed",
  "subject_milestone",
] as const;

export type RewardEventType =
  (typeof rewardEventTypes)[number];

export type RewardAmounts = Readonly<{
  xp: number;
  coins: number;
  constructionPoints: number;
}>;

export type ProgressionBalances = Readonly<{
  totalXp: number;
  coins: number;
  constructionPoints: number;
}>;

export type RewardEvent = Readonly<{
  id: string;
  userId: string;
  eventType: RewardEventType;
  sourceId: string;

  subjectId?: string | null;
  rewards: RewardAmounts;
  createdAt: string;
}>;

export type RewardEventInput = Readonly<{
  userId: string;
  eventType: RewardEventType;
  sourceId: string;
  rewards: RewardAmounts;
}>;

export type LevelProgress = Readonly<{
  level: number;

  totalXp: number;

  levelStartXp: number;

  nextLevelXp: number | null;

  xpIntoLevel: number;

  xpNeededForNextLevel: number | null;

  progress: number;
}>;

export type ProgressionSnapshot = Readonly<{
  balances: ProgressionBalances;
  level: LevelProgress;
}>;

export type FocusRewardContext = Readonly<{
  focusSessionId: string;
  durationMinutes: number;
  subjectId?: string;
}>;

export type TaskRewardContext = Readonly<{
  taskId: string;
  subjectId?: string;
}>;

export type SubjectProgressSnapshot = Readonly<{
  subjectId: string;

  subjectName: string;

  archivedAt: string | null;

  totalXp: number;

  totalStudyMinutes: number;

  completedFocusSessions: number;

  completedTasks: number;

  mastery: LevelProgress;
}>;

export type SubjectMasteryRow = Readonly<{
  subjectId: string;

  subjectName: string;

  archivedAt: string | null;

  totalXp: number;

  totalStudyMinutes: number;

  completedFocusSessions: number;

  completedTasks: number;
}>;

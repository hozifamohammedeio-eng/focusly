import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateLevelProgress,
  levelFromTotalXp,
  totalXpRequiredForLevel,
  xpRequiredForNextLevel,
} from "../src/features/progression/levels";

import {
  calculateAchievementRewards,
  calculateChallengeRewards,
  calculateFocusRewards,
  calculateTaskRewards,
} from "../src/features/progression/rewards";

import {
  createRewardEventIdentity,
  isSameRewardSource,
  normalizeRewardEventInput,
  rewardEventIdentityKey,
} from "../src/features/progression/events";

import {
  buildFocusRewardEvent,
  buildTaskRewardEvent,
} from "../src/features/progression/builders";

import {
  applyRewardToBalances,
  calculateBalancesFromEvents,
  calculateProgressionFromEvents,
  createProgressionSnapshot,
  EMPTY_PROGRESSION_BALANCES,
  sumRewards,
} from "../src/features/progression/calculator";

import {
  createSubjectProgressSnapshot,
  createSubjectProgressSnapshots,
} from "../src/features/progression/mastery";

import type {
  RewardEvent,
} from "../src/features/progression/types";

test(
  "level 1 starts at 0 XP",
  () => {
    assert.equal(
      totalXpRequiredForLevel(1),
      0,
    );
  },
);

test(
  "level XP curve is correct",
  () => {
    assert.equal(
      xpRequiredForNextLevel(1),
      100,
    );

    assert.equal(
      xpRequiredForNextLevel(2),
      125,
    );

    assert.equal(
      xpRequiredForNextLevel(3),
      150,
    );

    assert.equal(
      xpRequiredForNextLevel(4),
      175,
    );
  },
);

test(
  "total XP thresholds are correct",
  () => {
    assert.equal(
      totalXpRequiredForLevel(2),
      100,
    );

    assert.equal(
      totalXpRequiredForLevel(3),
      225,
    );

    assert.equal(
      totalXpRequiredForLevel(4),
      375,
    );

    assert.equal(
      totalXpRequiredForLevel(5),
      550,
    );
  },
);

test(
  "level resolves correctly from total XP",
  () => {
    assert.equal(
      levelFromTotalXp(0),
      1,
    );

    assert.equal(
      levelFromTotalXp(99),
      1,
    );

    assert.equal(
      levelFromTotalXp(100),
      2,
    );

    assert.equal(
      levelFromTotalXp(224),
      2,
    );

    assert.equal(
      levelFromTotalXp(225),
      3,
    );

    assert.equal(
      levelFromTotalXp(375),
      4,
    );
  },
);

test(
  "level progress returns correct values",
  () => {
    const progress =
      calculateLevelProgress(150);

    assert.equal(
      progress.level,
      2,
    );

    assert.equal(
      progress.totalXp,
      150,
    );

    assert.equal(
      progress.levelStartXp,
      100,
    );

    assert.equal(
      progress.nextLevelXp,
      225,
    );

    assert.equal(
      progress.xpIntoLevel,
      50,
    );

    assert.equal(
      progress.xpNeededForNextLevel,
      125,
    );

    assert.equal(
      progress.progress,
      0.4,
    );
  },
);

test(
  "invalid XP is rejected",
  () => {
    assert.throws(
      () => {
        levelFromTotalXp(-1);
      },
      RangeError,
    );

    assert.throws(
      () => {
        levelFromTotalXp(1.5);
      },
      RangeError,
    );
  },
);

test(
  "25 minute focus reward is correct",
  () => {
    assert.deepEqual(
      calculateFocusRewards(25),
      {
        xp: 25,
        coins: 5,
        constructionPoints: 5,
      },
    );
  },
);

test(
  "50 minute focus reward is correct",
  () => {
    assert.deepEqual(
      calculateFocusRewards(50),
      {
        xp: 50,
        coins: 10,
        constructionPoints: 10,
      },
    );
  },
);

test(
  "60 minute focus reward is correct",
  () => {
    assert.deepEqual(
      calculateFocusRewards(60),
      {
        xp: 60,
        coins: 12,
        constructionPoints: 12,
      },
    );
  },
);

test(
  "short valid focus duration still gives XP",
  () => {
    assert.deepEqual(
      calculateFocusRewards(4),
      {
        xp: 4,
        coins: 0,
        constructionPoints: 0,
      },
    );
  },
);

test(
  "invalid focus duration is rejected",
  () => {
    assert.throws(
      () => {
        calculateFocusRewards(0);
      },
      RangeError,
    );

    assert.throws(
      () => {
        calculateFocusRewards(-10);
      },
      RangeError,
    );

    assert.throws(
      () => {
        calculateFocusRewards(10.5);
      },
      RangeError,
    );
  },
);

test(
  "task reward is correct",
  () => {
    assert.deepEqual(
      calculateTaskRewards(),
      {
        xp: 15,
        coins: 2,
        constructionPoints: 1,
      },
    );
  },
);

test(
  "achievement reward is correct",
  () => {
    assert.deepEqual(
      calculateAchievementRewards(),
      {
        xp: 25,
        coins: 5,
        constructionPoints: 0,
      },
    );
  },
);

test(
  "daily challenge reward is correct",
  () => {
    assert.deepEqual(
      calculateChallengeRewards(
        "daily",
      ),
      {
        xp: 50,
        coins: 10,
        constructionPoints: 0,
      },
    );
  },
);

test(
  "weekly challenge reward is correct",
  () => {
    assert.deepEqual(
      calculateChallengeRewards(
        "weekly",
      ),
      {
        xp: 150,
        coins: 30,
        constructionPoints: 0,
      },
    );
  },
);

test(
  "reward identity is normalized",
  () => {
    const identity =
      createRewardEventIdentity({
        userId: " user-1 ",
        eventType:
          "focus_completed",
        sourceId:
          " session-1 ",
      });

    assert.deepEqual(
      identity,
      {
        userId: "user-1",
        eventType:
          "focus_completed",
        sourceId:
          "session-1",
      },
    );
  },
);

test(
  "same reward source produces same identity key",
  () => {
    const first = {
      userId: "user-1",
      eventType:
        "focus_completed" as const,
      sourceId: "session-1",
    };

    const second = {
      userId: "user-1",
      eventType:
        "focus_completed" as const,
      sourceId: "session-1",
    };

    assert.equal(
      rewardEventIdentityKey(first),
      rewardEventIdentityKey(second),
    );

    assert.equal(
      isSameRewardSource(
        first,
        second,
      ),
      true,
    );
  },
);

test(
  "different source does not match reward identity",
  () => {
    assert.equal(
      isSameRewardSource(
        {
          userId: "user-1",
          eventType:
            "focus_completed",
          sourceId:
            "session-1",
        },
        {
          userId: "user-1",
          eventType:
            "focus_completed",
          sourceId:
            "session-2",
        },
      ),
      false,
    );
  },
);

test(
  "invalid reward amount is rejected",
  () => {
    assert.throws(
      () => {
        normalizeRewardEventInput({
          userId: "user-1",
          eventType:
            "task_completed",
          sourceId:
            "task-1",

          rewards: {
            xp: -1,
            coins: 0,
            constructionPoints: 0,
          },
        });
      },
      RangeError,
    );
  },
);

test(
  "focus reward builder uses progression rules",
  () => {
    const event =
      buildFocusRewardEvent(
        "user-1",
        {
          focusSessionId:
            "focus-123",
          durationMinutes: 25,
          subjectId:
            "subject-1",
        },
      );

    assert.deepEqual(
      event,
      {
        userId: "user-1",
        eventType:
          "focus_completed",
        sourceId:
          "focus-123",

        rewards: {
          xp: 25,
          coins: 5,
          constructionPoints: 5,
        },
      },
    );
  },
);

test(
  "task reward builder uses progression rules",
  () => {
    const event =
      buildTaskRewardEvent(
        "user-1",
        {
          taskId: "task-123",
          subjectId:
            "subject-1",
        },
      );

    assert.deepEqual(
      event,
      {
        userId: "user-1",
        eventType:
          "task_completed",
        sourceId:
          "task-123",

        rewards: {
          xp: 15,
          coins: 2,
          constructionPoints: 1,
        },
      },
    );
  },
);

test(
  "reward amounts can be summed",
  () => {
    const total =
      sumRewards([
        {
          xp: 25,
          coins: 5,
          constructionPoints: 5,
        },
        {
          xp: 15,
          coins: 2,
          constructionPoints: 1,
        },
      ]);

    assert.deepEqual(
      total,
      {
        xp: 40,
        coins: 7,
        constructionPoints: 6,
      },
    );
  },
);

test(
  "reward can be applied to balances",
  () => {
    const balances =
      applyRewardToBalances(
        EMPTY_PROGRESSION_BALANCES,
        {
          xp: 25,
          coins: 5,
          constructionPoints: 5,
        },
      );

    assert.deepEqual(
      balances,
      {
        totalXp: 25,
        coins: 5,
        constructionPoints: 5,
      },
    );
  },
);

test(
  "progression snapshot resolves level",
  () => {
    const snapshot =
      createProgressionSnapshot({
        totalXp: 150,
        coins: 25,
        constructionPoints: 12,
      });

    assert.equal(
      snapshot.level.level,
      2,
    );

    assert.equal(
      snapshot.level.progress,
      0.4,
    );

    assert.equal(
      snapshot.balances.coins,
      25,
    );
  },
);

test(
  "progression can be reconstructed from reward history",
  () => {
    const events:
      RewardEvent[] = [
        {
          id: "reward-1",
          userId: "user-1",
          eventType:
            "focus_completed",
          sourceId:
            "focus-1",

          rewards: {
            xp: 100,
            coins: 20,
            constructionPoints: 20,
          },

          createdAt:
            "2026-09-25T12:00:00.000Z",
        },

        {
          id: "reward-2",
          userId: "user-1",
          eventType:
            "task_completed",
          sourceId:
            "task-1",

          rewards: {
            xp: 15,
            coins: 2,
            constructionPoints: 1,
          },

          createdAt:
            "2026-09-25T13:00:00.000Z",
        },
      ];

    const balances =
      calculateBalancesFromEvents(
        events,
      );

    assert.deepEqual(
      balances,
      {
        totalXp: 115,
        coins: 22,
        constructionPoints: 21,
      },
    );

    const snapshot =
      calculateProgressionFromEvents(
        events,
      );

    assert.equal(
      snapshot.level.level,
      2,
    );

    assert.equal(
      snapshot.balances.totalXp,
      115,
    );
  },
);

test("zero XP subject mastery starts at level 1", () => {
  const snapshot = createSubjectProgressSnapshot({
    subjectId: "subject-1",
    subjectName: "Mathematics",
    archivedAt: null,
    totalXp: 0,
    totalStudyMinutes: 0,
    completedFocusSessions: 0,
    completedTasks: 0,
  });
  assert.equal(snapshot.mastery.level, 1);
  assert.equal(snapshot.mastery.progress, 0);
});

test("subject mastery uses the shared level boundaries", () => {
  const snapshots = createSubjectProgressSnapshots([
    {
      subjectId: "subject-1",
      subjectName: "Physics",
      archivedAt: null,
      totalXp: 99,
      totalStudyMinutes: 25,
      completedFocusSessions: 1,
      completedTasks: 0,
    },
    {
      subjectId: "subject-2",
      subjectName: "Chemistry",
      archivedAt: null,
      totalXp: 100,
      totalStudyMinutes: 50,
      completedFocusSessions: 2,
      completedTasks: 1,
    },
  ]);
  assert.equal(snapshots[0]?.mastery.level, 1);
  assert.equal(snapshots[1]?.mastery.level, 2);
  assert.equal(snapshots[1]?.mastery.levelStartXp, 100);
});

test("subject mastery conversion is deterministic", () => {
  const row = {
    subjectId: "subject-1",
    subjectName: "Arabic",
    archivedAt: "2026-09-25T12:00:00.000Z",
    totalXp: 225,
    totalStudyMinutes: 75,
    completedFocusSessions: 3,
    completedTasks: 2,
  };
  assert.deepEqual(
    createSubjectProgressSnapshot(row),
    createSubjectProgressSnapshot(row),
  );
});

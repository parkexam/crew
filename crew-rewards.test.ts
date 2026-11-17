import { describe, expect, it } from "vitest";
import { getCrewRewardProgress, getWeeklyCrewBadges } from "./crew-rewards";

const runner = (id: number, overrides: Partial<{
  distanceM: number;
  durationSec: number;
  runCount: number;
  paceSec: number;
  paceEligibleRuns: number;
  paceEligibleDistanceM: number;
  paceEligibleSecPerKm: number;
}> = {}) => ({
  id,
  distanceM: 0,
  durationSec: 0,
  runCount: 0,
  paceSec: 0,
  paceEligibleRuns: 0,
  paceEligibleDistanceM: 0,
  paceEligibleSecPerKm: 0,
  ...overrides,
});

describe("weekly crew rewards", () => {
  it("awards first-run and consistency badges at their thresholds", () => {
    const awards = getWeeklyCrewBadges([
      runner(1, { runCount: 1, distanceM: 1200 }),
      runner(2, { runCount: 3, distanceM: 4100 }),
    ]);

    expect(awards.get(1)?.map(badge => badge.id)).toContain("first-run");
    expect(awards.get(1)?.map(badge => badge.id)).not.toContain("steady-runner");
    expect(awards.get(2)?.map(badge => badge.id)).toEqual(
      expect.arrayContaining(["first-run", "steady-runner", "distance-leader"]),
    );
  });

  it("gives distance and eligible pace ties to every tied runner", () => {
    const awards = getWeeklyCrewBadges([
      runner(1, {
        runCount: 2,
        distanceM: 4000,
        paceEligibleRuns: 2,
        paceEligibleDistanceM: 4000,
        paceEligibleSecPerKm: 330,
      }),
      runner(2, {
        runCount: 2,
        distanceM: 4000,
        paceEligibleRuns: 2,
        paceEligibleDistanceM: 4000,
        paceEligibleSecPerKm: 330,
      }),
      runner(3, {
        runCount: 1,
        distanceM: 2500,
        paceEligibleRuns: 1,
        paceEligibleDistanceM: 2500,
        paceEligibleSecPerKm: 300,
      }),
    ]);

    expect(awards.get(1)?.map(badge => badge.id)).toContain("distance-leader");
    expect(awards.get(2)?.map(badge => badge.id)).toContain("distance-leader");
    expect(awards.get(1)?.map(badge => badge.id)).toContain("pace-maker");
    expect(awards.get(2)?.map(badge => badge.id)).toContain("pace-maker");
    expect(awards.get(3)?.map(badge => badge.id)).not.toContain("pace-maker");
  });

  it("unlocks shared milestones and reports the next remaining distance", () => {
    const progress = getCrewRewardProgress(51_000, 100_000);

    expect(progress.percent).toBe(51);
    expect(progress.milestones.filter(item => item.unlocked).map(item => item.percent)).toEqual([
      25, 50,
    ]);
    expect(progress.nextMilestone?.percent).toBe(75);
    expect(progress.remainingM).toBe(24_000);
  });

  it("caps progress and marks every milestone complete at the weekly goal", () => {
    const progress = getCrewRewardProgress(112_000, 100_000);

    expect(progress.percent).toBe(100);
    expect(progress.nextMilestone).toBeNull();
    expect(progress.remainingM).toBe(0);
  });
});

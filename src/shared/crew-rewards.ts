/** Deterministic weekly, non-monetary crew rewards derived from logged activity. */

export type CrewRewardMember = {
  id: number;
  distanceM: number;
  durationSec: number;
  runCount: number;
  paceSec: number;
  paceEligibleRuns: number;
  paceEligibleDistanceM: number;
  paceEligibleSecPerKm: number;
};

export type CrewBadgeId =
  | "first-run"
  | "steady-runner"
  | "distance-leader"
  | "pace-maker";

export type CrewBadge = {
  id: CrewBadgeId;
  label: string;
  description: string;
};

export const WEEKLY_CREW_BADGES: CrewBadge[] = [
  {
    id: "first-run",
    label: "첫 발",
    description: "이번 주 러닝 기록 1회 이상",
  },
  {
    id: "steady-runner",
    label: "꾸준 러너",
    description: "이번 주 러닝 기록 3회 이상",
  },
  {
    id: "distance-leader",
    label: "거리 리더",
    description: "이번 주 누적 러닝 거리 공동 1위. 동점자 모두 획득",
  },
  {
    id: "pace-maker",
    label: "페이스 메이커",
    description:
      "1km 이상 러닝 2회 및 적격 누적 거리 3km 이상인 러너 중 평균 페이스 1위",
  },
];

export const CREW_MILESTONES = [
  { percent: 25, label: "출발" },
  { percent: 50, label: "절반 돌파" },
  { percent: 75, label: "막판 스퍼트" },
  { percent: 100, label: "크루 완주" },
] as const;

/** Returns all weekly badge awards, including all runners tied for a lead. */
export function getWeeklyCrewBadges(
  members: CrewRewardMember[]
): Map<number, CrewBadge[]> {
  const awarded = new Map<number, CrewBadge[]>();
  for (const member of members) awarded.set(member.id, []);

  const add = (id: number, badgeId: CrewBadgeId) => {
    const badge = WEEKLY_CREW_BADGES.find(item => item.id === badgeId);
    if (!badge) return;
    awarded.get(id)?.push(badge);
  };

  for (const member of members) {
    if (member.runCount >= 1) add(member.id, "first-run");
    if (member.runCount >= 3) add(member.id, "steady-runner");
  }

  const activeRunners = members.filter(member => member.distanceM > 0);
  if (activeRunners.length > 0) {
    const leadingDistance = Math.max(
      ...activeRunners.map(member => member.distanceM)
    );
    for (const member of activeRunners) {
      if (member.distanceM === leadingDistance)
        add(member.id, "distance-leader");
    }
  }

  const paceEligible = members.filter(
    member =>
      member.paceEligibleRuns >= 2 &&
      member.paceEligibleDistanceM >= 3000 &&
      member.paceEligibleSecPerKm > 0
  );
  if (paceEligible.length > 0) {
    const leadingPace = Math.min(
      ...paceEligible.map(member => member.paceEligibleSecPerKm)
    );
    for (const member of paceEligible) {
      if (member.paceEligibleSecPerKm === leadingPace)
        add(member.id, "pace-maker");
    }
  }

  return awarded;
}

export type CrewMilestoneStatus = {
  percent: number;
  label: string;
  targetM: number;
  unlocked: boolean;
};

export type CrewRewardProgress = {
  percent: number;
  currentM: number;
  goalM: number;
  milestones: CrewMilestoneStatus[];
  nextMilestone: CrewMilestoneStatus | null;
  remainingM: number;
};

export function getCrewRewardProgress(
  totalDistanceM: number,
  weeklyGoalM: number
): CrewRewardProgress {
  const currentM = Math.max(0, Math.round(totalDistanceM));
  const goalM = Math.max(0, Math.round(weeklyGoalM));
  const percent =
    goalM > 0 ? Math.min(100, Math.floor((currentM / goalM) * 100)) : 0;
  const milestones = CREW_MILESTONES.map(item => {
    const targetM = goalM > 0 ? Math.ceil((goalM * item.percent) / 100) : 0;
    return {
      ...item,
      targetM,
      unlocked: goalM > 0 && currentM >= targetM,
    };
  });
  const nextMilestone = milestones.find(item => !item.unlocked) ?? null;

  return {
    percent,
    currentM,
    goalM,
    milestones,
    nextMilestone,
    remainingM: nextMilestone
      ? Math.max(0, nextMilestone.targetM - currentM)
      : 0,
  };
}

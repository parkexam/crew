/**
 * 발맞춤 도메인 API.
 *
 * 서버(tRPC + Drizzle + MySQL)에 있던 service.ts / seed.ts 로직을
 * 기기 스토어(src/lib/db.ts) 위에서 동일한 응답 형태로 다시 구현했다.
 */
import {
  addDays,
  AVATARS,
  BODY_PARTS,
  buildRoutine,
  calculateStreak,
  computeBalance,
  dateKeyOf,
  DEMO_CREW_CODE,
  findExercise,
  formatKm,
  isBodyPart,
  percent,
  weekStart,
  type BalanceResult,
  type BodyPart,
} from "@shared/fitness";
import { getDb, mutate, type CrewRow, type RunnerRow, type WorkoutRow } from "./db";
import { getSession } from "./session";

const CREW_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PublicRunner = {
  id: number;
  handle: string;
  nickname: string;
  avatar: string;
  crewId: number | null;
  dailyGoalM: number;
  dailyGoalMin: number;
  weeklyGoalM: number;
};

export type CrewSummary = { id: number; name: string; code: string };

export type MemberStat = {
  id: number;
  nickname: string;
  avatar: string;
  distanceM: number;
  durationSec: number;
  runCount: number;
  paceSec: number;
  paceEligibleRuns: number;
  paceEligibleDistanceM: number;
  paceEligibleSecPerKm: number;
  isMe: boolean;
  rank: number;
};

export type RunView = {
  id: number;
  distanceM: number;
  durationSec: number;
  paceSec: number;
  startedAt: string;
  dateKey: string;
  note: string | null;
};

export type WorkoutView = {
  id: number;
  bodyPart: string;
  exerciseSlug: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg: number;
  durationMin: number;
  dateKey: string;
  createdAt: string;
};

export type SessionPayload = { runner: PublicRunner; crew: CrewSummary | null };

function toPublicRunner(runner: RunnerRow): PublicRunner {
  return {
    id: runner.id,
    handle: runner.handle,
    nickname: runner.nickname,
    avatar: runner.avatar,
    crewId: runner.crewId,
    dailyGoalM: runner.dailyGoalM,
    dailyGoalMin: runner.dailyGoalMin,
    weeklyGoalM: runner.weeklyGoalM,
  };
}

function crewSummary(crew: CrewRow | null | undefined): CrewSummary | null {
  return crew ? { id: crew.id, name: crew.name, code: crew.code } : null;
}

function randomId(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CREW_CODE_ALPHABET.charAt(Math.floor(Math.random() * CREW_CODE_ALPHABET.length));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 세션                                                                */
/* ------------------------------------------------------------------ */

/** 기기에 저장된 세션으로 러너를 찾는다. */
export function authenticate(): RunnerRow | null {
  const session = getSession();
  if (!session) return null;
  const runner = getDb().runners.find(row => row.handle === session.handle);
  if (!runner || runner.token !== session.token) return null;
  return runner;
}

function requireRunner(): RunnerRow {
  const runner = authenticate();
  if (!runner) throw new Error("RUNNER_REQUIRED");
  return runner;
}

export function me(): SessionPayload | null {
  const runner = authenticate();
  if (!runner) return null;
  const crew = getDb().crews.find(row => row.id === runner.crewId) ?? null;
  return { runner: toPublicRunner(runner), crew: crewSummary(crew) };
}

export function createSession(input: {
  nickname: string;
  avatar: string;
  dailyGoalM: number;
  dailyGoalMin: number;
  baseline?: Partial<Record<BodyPart, number>>;
}) {
  const nickname = input.nickname.trim().slice(0, 12);
  if (!nickname) throw new Error("닉네임을 입력해 주세요.");

  return mutate(db => {
    const demoCrew = db.crews.find(crew => crew.code === DEMO_CREW_CODE) ?? null;
    const avatar = AVATARS.includes(input.avatar) ? input.avatar : AVATARS[0];

    db.seq.runner += 1;
    const runner: RunnerRow = {
      id: db.seq.runner,
      handle: `r_${randomId(12).toLowerCase()}`,
      token: `${randomId(16)}${randomId(16)}`.toLowerCase(),
      nickname,
      avatar,
      crewId: demoCrew?.id ?? null,
      dailyGoalM: Math.round(input.dailyGoalM),
      dailyGoalMin: Math.round(input.dailyGoalMin),
      weeklyGoalM: Math.max(Math.round(input.dailyGoalM) * 5, 10000),
      baseline: input.baseline ?? null,
      isDemo: 0,
      createdAt: new Date().toISOString(),
    };
    db.runners.push(runner);

    return {
      runner: toPublicRunner(runner),
      token: runner.token,
      crew: crewSummary(demoCrew),
    };
  });
}

export function updateProfile(input: {
  nickname?: string;
  avatar?: string;
  baseline?: Partial<Record<BodyPart, number>>;
}) {
  const runner = requireRunner();
  return mutate(db => {
    const row = db.runners.find(item => item.id === runner.id);
    if (!row) throw new Error("계정을 찾을 수 없습니다.");
    if (input.nickname !== undefined) row.nickname = input.nickname.trim().slice(0, 12);
    if (input.avatar !== undefined && AVATARS.includes(input.avatar)) row.avatar = input.avatar;
    if (input.baseline !== undefined) row.baseline = input.baseline;
    return { runner: toPublicRunner(row) };
  });
}

export function setGoals(input: {
  dailyGoalM?: number;
  dailyGoalMin?: number;
  weeklyGoalM?: number;
}) {
  const runner = requireRunner();
  return mutate(db => {
    const row = db.runners.find(item => item.id === runner.id);
    if (!row) throw new Error("계정을 찾을 수 없습니다.");
    if (input.dailyGoalM !== undefined) row.dailyGoalM = Math.round(input.dailyGoalM);
    if (input.dailyGoalMin !== undefined) row.dailyGoalMin = Math.round(input.dailyGoalMin);
    if (input.weeklyGoalM !== undefined) row.weeklyGoalM = Math.round(input.weeklyGoalM);
    return { runner: toPublicRunner(row) };
  });
}

/* ------------------------------------------------------------------ */
/* 크루                                                                */
/* ------------------------------------------------------------------ */

function buildMemberStats(
  members: RunnerRow[],
  runRows: { runnerId: number; distanceM: number; durationSec: number }[],
  myId: number,
): MemberStat[] {
  const stats = members.map(member => {
    const mine = runRows.filter(row => row.runnerId === member.id);
    const distanceM = mine.reduce((sum, row) => sum + row.distanceM, 0);
    const durationSec = mine.reduce((sum, row) => sum + row.durationSec, 0);
    const paceEligible = mine.filter(row => row.distanceM >= 1000 && row.durationSec > 0);
    const paceEligibleDistanceM = paceEligible.reduce((sum, row) => sum + row.distanceM, 0);
    const paceEligibleDurationSec = paceEligible.reduce((sum, row) => sum + row.durationSec, 0);
    return {
      id: member.id,
      nickname: member.nickname,
      avatar: member.avatar,
      distanceM,
      durationSec,
      runCount: mine.length,
      paceSec: distanceM > 0 ? Math.round(durationSec / (distanceM / 1000)) : 0,
      paceEligibleRuns: paceEligible.length,
      paceEligibleDistanceM,
      paceEligibleSecPerKm:
        paceEligibleDistanceM > 0
          ? Math.round(paceEligibleDurationSec / (paceEligibleDistanceM / 1000))
          : 0,
      isMe: member.id === myId,
      rank: 0,
    };
  });

  stats.sort((a, b) => {
    if (b.distanceM !== a.distanceM) return b.distanceM - a.distanceM;
    return b.durationSec - a.durationSec;
  });
  stats.forEach((stat, index) => {
    stat.rank = index + 1;
  });
  return stats;
}

function loadCrewContext(runner: RunnerRow) {
  const db = getDb();
  if (!runner.crewId) return { crew: null as CrewRow | null, members: [] as RunnerRow[] };
  const crew = db.crews.find(row => row.id === runner.crewId) ?? null;
  if (!crew) return { crew: null as CrewRow | null, members: [] as RunnerRow[] };
  const members = db.runners.filter(row => row.crewId === crew.id);
  return { crew, members };
}

export function crewOverview() {
  const runner = requireRunner();
  const db = getDb();
  const { crew, members } = loadCrewContext(runner);

  if (!crew) {
    return { crew: null, week: [] as MemberStat[], month: [] as MemberStat[], feed: [], weekTotalM: 0, monthTotalM: 0 };
  }

  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const recentStart = monday < monthStart ? monday : monthStart;
  const memberIds = new Set(members.map(member => member.id));

  const recentRuns = db.runs
    .filter(run => memberIds.has(run.runnerId) && run.dateKey >= recentStart)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  const week = buildMemberStats(
    members,
    recentRuns.filter(row => row.dateKey >= monday),
    runner.id,
  );
  const month = buildMemberStats(
    members,
    recentRuns.filter(row => row.dateKey >= monthStart),
    runner.id,
  );

  const memberById = new Map(members.map(member => [member.id, member]));
  const feed = recentRuns.slice(0, 14).map(row => {
    const owner = memberById.get(row.runnerId);
    return {
      id: row.id,
      runnerId: row.runnerId,
      nickname: owner?.nickname ?? "러너",
      avatar: owner?.avatar ?? "🐰",
      isMe: row.runnerId === runner.id,
      distanceM: row.distanceM,
      durationSec: row.durationSec,
      paceSec: row.distanceM > 0 ? Math.round(row.durationSec / (row.distanceM / 1000)) : 0,
      startedAt: row.startedAt,
      dateKey: row.dateKey,
      note: row.note,
    };
  });

  return {
    crew: {
      id: crew.id,
      name: crew.name,
      code: crew.code,
      weeklyGoalM: crew.weeklyGoalM,
      memberCount: members.length,
      isOwner: crew.ownerRunnerId === runner.id,
    },
    week,
    month,
    feed,
    weekTotalM: week.reduce((sum, member) => sum + member.distanceM, 0),
    monthTotalM: month.reduce((sum, member) => sum + member.distanceM, 0),
  };
}

export function joinCrew(rawCode: string) {
  const runner = requireRunner();
  const code = rawCode.trim().toUpperCase();
  if (code.length < 4) throw new Error("초대 코드를 정확히 입력해 주세요.");

  return mutate(db => {
    const crew = db.crews.find(row => row.code === code);
    if (!crew) {
      throw new Error("해당 코드의 크루를 찾지 못했습니다. 코드를 다시 확인해 주세요.");
    }
    if (runner.crewId === crew.id) {
      return { crew: crewSummary(crew), alreadyMember: true };
    }
    const row = db.runners.find(item => item.id === runner.id);
    if (row) row.crewId = crew.id;
    return { crew: crewSummary(crew), alreadyMember: false };
  });
}

export function createCrew(input: { name: string; weeklyGoalKm: number }) {
  const runner = requireRunner();
  const name = input.name.trim().slice(0, 30);
  if (!name) throw new Error("크루 이름을 입력해 주세요.");

  return mutate(db => {
    let code = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      code = randomId(6);
      if (!db.crews.some(crew => crew.code === code)) break;
      code = "";
    }
    if (!code) throw new Error("초대 코드를 만들지 못했습니다. 다시 시도해 주세요.");

    db.seq.crew += 1;
    const crew: CrewRow = {
      id: db.seq.crew,
      code,
      name,
      weeklyGoalM: Math.round(input.weeklyGoalKm * 1000),
      ownerRunnerId: runner.id,
      isDemo: 0,
      createdAt: new Date().toISOString(),
    };
    db.crews.push(crew);

    const row = db.runners.find(item => item.id === runner.id);
    if (row) row.crewId = crew.id;

    return { crew: crewSummary(crew) };
  });
}

export function leaveCrew() {
  const runner = requireRunner();
  return mutate(db => {
    const row = db.runners.find(item => item.id === runner.id);
    if (row) row.crewId = null;
    return { success: true } as const;
  });
}

/* ------------------------------------------------------------------ */
/* 러닝 기록                                                            */
/* ------------------------------------------------------------------ */

function toRunView(row: {
  id: number;
  distanceM: number;
  durationSec: number;
  startedAt: string;
  dateKey: string;
  note: string | null;
}): RunView {
  return {
    id: row.id,
    distanceM: row.distanceM,
    durationSec: row.durationSec,
    paceSec: row.distanceM > 0 ? Math.round(row.durationSec / (row.distanceM / 1000)) : 0,
    startedAt: row.startedAt,
    dateKey: row.dateKey,
    note: row.note,
  };
}

export function logRun(input: {
  distanceM: number;
  durationSec: number;
  startedAt: string;
  note?: string;
}) {
  const runner = requireRunner();
  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime())) throw new Error("시작 시간이 올바르지 않습니다.");
  if (!Number.isFinite(input.distanceM) || input.distanceM < 50) {
    throw new Error("거리를 0.05km 이상 입력해 주세요.");
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec < 10) {
    throw new Error("시간을 10초 이상 입력해 주세요.");
  }
  const dateKey = dateKeyOf(startedAt);

  return mutate(db => {
    db.seq.run += 1;
    db.runs.push({
      id: db.seq.run,
      runnerId: runner.id,
      distanceM: Math.round(input.distanceM),
      durationSec: Math.round(input.durationSec),
      startedAt: startedAt.toISOString(),
      dateKey,
      note: input.note?.trim().slice(0, 140) || null,
      source: "manual",
      createdAt: new Date().toISOString(),
    });
    return { success: true as const, dateKey };
  });
}

export function deleteRun(runId: number) {
  const runner = requireRunner();
  return mutate(db => {
    const index = db.runs.findIndex(row => row.id === runId && row.runnerId === runner.id);
    if (index < 0) throw new Error("기록을 찾을 수 없습니다.");
    db.runs.splice(index, 1);
    return { success: true } as const;
  });
}

export function listRuns(limit = 20): RunView[] {
  const runner = requireRunner();
  return getDb()
    .runs.filter(row => row.runnerId === runner.id)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .slice(0, limit)
    .map(toRunView);
}

/* ------------------------------------------------------------------ */
/* 대시보드 / 목표 / 밸런스                                              */
/* ------------------------------------------------------------------ */

function loadBalance(runner: RunnerRow, todayKey: string): BalanceResult {
  const since = addDays(todayKey, -29);
  const logs = getDb().workoutLogs.filter(
    log => log.runnerId === runner.id && log.dateKey >= since,
  );

  return computeBalance(
    logs.map(log => ({
      bodyPart: log.bodyPart,
      sets: log.sets,
      reps: log.reps,
      weightKg: log.weightKg,
      durationMin: log.durationMin,
      dateKey: log.dateKey,
    })),
    runner.baseline,
    todayKey,
  );
}

function loadActiveDays(runner: RunnerRow, todayKey: string): string[] {
  const db = getDb();
  const since = addDays(todayKey, -180);
  const runDays = db.runs
    .filter(row => row.runnerId === runner.id && row.dateKey >= since)
    .map(row => row.dateKey);
  const workoutDays = db.workoutLogs
    .filter(row => row.runnerId === runner.id && row.dateKey >= since)
    .map(row => row.dateKey);
  return [...new Set([...runDays, ...workoutDays])];
}

export function dashboard() {
  const runner = requireRunner();
  const db = getDb();
  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);
  const { crew, members } = loadCrewContext(runner);
  const memberIds = new Set(members.length > 0 ? members.map(member => member.id) : [runner.id]);

  const myRuns = db.runs
    .filter(row => row.runnerId === runner.id)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .slice(0, 40);

  const weekCrewRuns = db.runs.filter(
    row => memberIds.has(row.runnerId) && row.dateKey >= monday,
  );

  const workoutRows = db.workoutLogs.filter(
    row => row.runnerId === runner.id && row.dateKey >= addDays(todayKey, -29),
  );

  const activeDays = loadActiveDays(runner, todayKey);

  const week = buildMemberStats(members, weekCrewRuns, runner.id);
  const myWeek = week.find(member => member.isMe);

  const todayRuns = myRuns.filter(row => row.dateKey === todayKey);
  const weekRuns = myRuns.filter(row => row.dateKey >= monday);
  const todayDistanceM = todayRuns.reduce((sum, row) => sum + row.distanceM, 0);
  const todayDurationSec = todayRuns.reduce((sum, row) => sum + row.durationSec, 0);
  const weekDistanceM = weekRuns.reduce((sum, row) => sum + row.distanceM, 0);
  const weekDurationSec = weekRuns.reduce((sum, row) => sum + row.durationSec, 0);

  const streak = calculateStreak(activeDays, todayKey);

  const weekDots = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(monday, index);
    const dayDistanceM = myRuns
      .filter(row => row.dateKey === dateKey)
      .reduce((sum, row) => sum + row.distanceM, 0);
    return {
      dateKey,
      distanceM: dayDistanceM,
      done: dayDistanceM > 0,
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    };
  });

  const balance = computeBalance(
    workoutRows.map(log => ({
      bodyPart: log.bodyPart,
      sets: log.sets,
      reps: log.reps,
      weightKg: log.weightKg,
      durationMin: log.durationMin,
      dateKey: log.dateKey,
    })),
    runner.baseline,
    todayKey,
  );

  const routine = buildRoutine(balance);

  return {
    runner: toPublicRunner(runner),
    crew: crew
      ? {
          id: crew.id,
          name: crew.name,
          code: crew.code,
          weeklyGoalM: crew.weeklyGoalM,
          memberCount: members.length,
          weekTotalM: week.reduce((sum, member) => sum + member.distanceM, 0),
        }
      : null,
    week,
    myRank: myWeek?.rank ?? null,
    today: {
      distanceM: todayDistanceM,
      durationSec: todayDurationSec,
      goalM: runner.dailyGoalM,
      goalMin: runner.dailyGoalMin,
      pct: percent(todayDistanceM, runner.dailyGoalM),
      remainingM: Math.max(0, runner.dailyGoalM - todayDistanceM),
    },
    weekProgress: {
      distanceM: weekDistanceM,
      durationSec: weekDurationSec,
      goalM: runner.weeklyGoalM,
      pct: percent(weekDistanceM, runner.weeklyGoalM),
    },
    streak,
    weekDots,
    recentRuns: myRuns.slice(0, 4).map(toRunView),
    balance,
    routine,
    summary: {
      todayLabel: `${formatKm(todayDistanceM)}km`,
      weekLabel: `${formatKm(weekDistanceM)}km`,
    },
  };
}

export function goals() {
  const runner = requireRunner();
  const db = getDb();
  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);

  const myRuns = db.runs
    .filter(row => row.runnerId === runner.id)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .slice(0, 500);

  const workoutRows = db.workoutLogs.filter(
    row => row.runnerId === runner.id && row.dateKey >= addDays(todayKey, -180),
  );

  const activeDays = [
    ...new Set([...myRuns.map(row => row.dateKey), ...workoutRows.map(row => row.dateKey)]),
  ];
  const streak = calculateStreak(activeDays, todayKey);

  const calendarStart = addDays(todayKey, -83);
  const distanceByDate = new Map<string, number>();
  for (const run of myRuns) {
    distanceByDate.set(run.dateKey, (distanceByDate.get(run.dateKey) ?? 0) + run.distanceM);
  }
  const workoutDates = new Set(workoutRows.map(row => row.dateKey));

  const calendar = Array.from({ length: 84 }, (_, index) => {
    const dateKey = addDays(calendarStart, index);
    return {
      dateKey,
      distanceM: distanceByDate.get(dateKey) ?? 0,
      hasWorkout: workoutDates.has(dateKey),
    };
  });

  const totalDistanceM = myRuns.reduce((sum, row) => sum + row.distanceM, 0);
  const totalDurationSec = myRuns.reduce((sum, row) => sum + row.durationSec, 0);
  const longest = myRuns.reduce(
    (best, row) => (row.distanceM > best.distanceM ? row : best),
    myRuns[0] ?? { distanceM: 0, durationSec: 0, id: 0 },
  );
  const pacedRuns = myRuns.filter(row => row.distanceM >= 1000 && row.durationSec > 0);
  const bestPace = pacedRuns.reduce<number | null>((best, row) => {
    const pace = row.durationSec / (row.distanceM / 1000);
    if (best === null || pace < best) return pace;
    return best;
  }, null);

  const todayRuns = myRuns.filter(row => row.dateKey === todayKey);
  const weekRuns = myRuns.filter(row => row.dateKey >= monday);

  return {
    runner: toPublicRunner(runner),
    streak,
    calendar,
    calendarStart,
    totals: {
      distanceM: totalDistanceM,
      durationSec: totalDurationSec,
      runCount: myRuns.length,
      longestM: longest.distanceM,
      bestPaceSec: bestPace === null ? 0 : Math.round(bestPace),
      activeDays: activeDays.length,
    },
    today: {
      distanceM: todayRuns.reduce((sum, row) => sum + row.distanceM, 0),
      durationSec: todayRuns.reduce((sum, row) => sum + row.durationSec, 0),
      goalM: runner.dailyGoalM,
      goalMin: runner.dailyGoalMin,
      pct: percent(
        todayRuns.reduce((sum, row) => sum + row.distanceM, 0),
        runner.dailyGoalM,
      ),
    },
    week: {
      distanceM: weekRuns.reduce((sum, row) => sum + row.distanceM, 0),
      durationSec: weekRuns.reduce((sum, row) => sum + row.durationSec, 0),
      goalM: runner.weeklyGoalM,
      pct: percent(
        weekRuns.reduce((sum, row) => sum + row.distanceM, 0),
        runner.weeklyGoalM,
      ),
    },
  };
}

function toWorkoutView(log: WorkoutRow): WorkoutView {
  return {
    id: log.id,
    bodyPart: log.bodyPart,
    exerciseSlug: log.exerciseSlug,
    exerciseName: log.exerciseName,
    sets: log.sets,
    reps: log.reps,
    weightKg: log.weightKg,
    durationMin: log.durationMin,
    dateKey: log.dateKey,
    createdAt: log.createdAt,
  };
}

export function balanceOverview() {
  const runner = requireRunner();
  const db = getDb();
  const todayKey = dateKeyOf(new Date());
  const balance = loadBalance(runner, todayKey);
  const logs = db.workoutLogs
    .filter(row => row.runnerId === runner.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 12);

  return {
    runner: toPublicRunner(runner),
    balance,
    routine: buildRoutine(balance),
    logs: logs.map(toWorkoutView),
    threshold: 4,
  };
}

export function logWorkout(input: {
  bodyPart: string;
  exerciseSlug: string;
  sets: number;
  reps: number;
  weightKg: number;
  durationMin: number;
  dateKey?: string;
}) {
  const runner = requireRunner();
  if (!isBodyPart(input.bodyPart)) throw new Error("운동 부위를 선택해 주세요.");
  const exercise = findExercise(input.exerciseSlug);
  if (!exercise) throw new Error("운동 종목을 찾을 수 없습니다.");

  const todayKey = dateKeyOf(new Date());
  const dateKey =
    input.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ? input.dateKey : todayKey;

  return mutate(db => {
    db.seq.workout += 1;
    db.workoutLogs.push({
      id: db.seq.workout,
      runnerId: runner.id,
      bodyPart: input.bodyPart,
      exerciseSlug: exercise.slug,
      exerciseName: exercise.name,
      sets: Math.round(input.sets),
      reps: Math.round(input.reps),
      weightKg: Math.round(input.weightKg),
      durationMin: Math.round(input.durationMin),
      dateKey,
      createdAt: new Date().toISOString(),
    });
    return { success: true as const, dateKey };
  });
}

export function deleteWorkout(logId: number) {
  const runner = requireRunner();
  return mutate(db => {
    const index = db.workoutLogs.findIndex(
      row => row.id === logId && row.runnerId === runner.id,
    );
    if (index < 0) throw new Error("운동 기록을 찾을 수 없습니다.");
    db.workoutLogs.splice(index, 1);
    return { success: true } as const;
  });
}

/** 부위 정의(온보딩 설문 UI에서 쓰는 목록)를 그대로 노출한다. */
export const BODY_PART_KEYS = BODY_PARTS.map(part => part.key);

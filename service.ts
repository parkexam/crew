import type { Request } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { crews, runners, runs, workoutLogs, type Runner } from "../../drizzle/schema";
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
} from "../../shared/fitness";
import { getDb } from "../db";
import { ensureDemoData } from "./seed";

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

function toPublicRunner(runner: Runner): PublicRunner {
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

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
  return db;
}

/* ------------------------------------------------------------------ */
/* 세션                                                                */
/* ------------------------------------------------------------------ */

export async function authenticateRunner(req: Request): Promise<Runner | null> {
  const rawHandle = req.headers["x-runner-handle"];
  const rawToken = req.headers["x-runner-token"];
  const handle = Array.isArray(rawHandle) ? rawHandle[0] : rawHandle;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!handle || !token) return null;

  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(runners).where(eq(runners.handle, handle)).limit(1);
  const runner = rows[0];
  if (!runner || runner.token !== token) return null;
  return runner;
}

export async function createRunner(input: {
  nickname: string;
  avatar: string;
  dailyGoalM: number;
  dailyGoalMin: number;
  baseline?: Partial<Record<BodyPart, number>>;
}) {
  const db = await requireDb();
  await ensureDemoData();

  const demoCrew = (
    await db.select().from(crews).where(eq(crews.code, DEMO_CREW_CODE)).limit(1)
  )[0];

  const avatar = AVATARS.includes(input.avatar) ? input.avatar : AVATARS[0];
  const handle = `r_${nanoid(12)}`;
  const token = nanoid(32);

  await db.insert(runners).values({
    handle,
    token,
    nickname: input.nickname.trim().slice(0, 12),
    avatar,
    crewId: demoCrew?.id ?? null,
    dailyGoalM: input.dailyGoalM,
    dailyGoalMin: input.dailyGoalMin,
    weeklyGoalM: Math.max(input.dailyGoalM * 5, 10000),
    baselineJson: input.baseline ? JSON.stringify(input.baseline) : null,
  });

  const created = (await db.select().from(runners).where(eq(runners.handle, handle)).limit(1))[0];
  if (!created) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "계정을 만들지 못했습니다." });
  }

  return {
    runner: toPublicRunner(created),
    token,
    crew: demoCrew
      ? { id: demoCrew.id, name: demoCrew.name, code: demoCrew.code }
      : null,
  };
}

export async function getSessionPayload(runner: Runner) {
  const db = await requireDb();
  let crew: { id: number; name: string; code: string } | null = null;
  if (runner.crewId) {
    const rows = await db.select().from(crews).where(eq(crews.id, runner.crewId)).limit(1);
    if (rows[0]) crew = { id: rows[0].id, name: rows[0].name, code: rows[0].code };
  }
  return { runner: toPublicRunner(runner), crew };
}

export async function updateProfile(
  runner: Runner,
  input: { nickname?: string; avatar?: string; baseline?: Partial<Record<BodyPart, number>> },
) {
  const db = await requireDb();
  const patch: Partial<Runner> = {};
  if (input.nickname !== undefined) patch.nickname = input.nickname.trim().slice(0, 12);
  if (input.avatar !== undefined && AVATARS.includes(input.avatar)) patch.avatar = input.avatar;
  if (input.baseline !== undefined) patch.baselineJson = JSON.stringify(input.baseline);
  if (Object.keys(patch).length > 0) {
    await db.update(runners).set(patch).where(eq(runners.id, runner.id));
  }
  const updated = (await db.select().from(runners).where(eq(runners.id, runner.id)).limit(1))[0];
  return { runner: toPublicRunner(updated ?? runner) };
}

export async function setGoals(
  runner: Runner,
  input: { dailyGoalM?: number; dailyGoalMin?: number; weeklyGoalM?: number },
) {
  const db = await requireDb();
  const patch: Partial<Runner> = {};
  if (input.dailyGoalM !== undefined) patch.dailyGoalM = input.dailyGoalM;
  if (input.dailyGoalMin !== undefined) patch.dailyGoalMin = input.dailyGoalMin;
  if (input.weeklyGoalM !== undefined) patch.weeklyGoalM = input.weeklyGoalM;
  if (Object.keys(patch).length > 0) {
    await db.update(runners).set(patch).where(eq(runners.id, runner.id));
  }
  const updated = (await db.select().from(runners).where(eq(runners.id, runner.id)).limit(1))[0];
  return { runner: toPublicRunner(updated ?? runner) };
}

/* ------------------------------------------------------------------ */
/* 크루                                                                */
/* ------------------------------------------------------------------ */

function buildMemberStats(
  members: Runner[],
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

async function loadCrewContext(runner: Runner) {
  const db = await requireDb();
  if (!runner.crewId) return { crew: null, members: [] as Runner[] };
  const crewRows = await db.select().from(crews).where(eq(crews.id, runner.crewId)).limit(1);
  if (!crewRows[0]) return { crew: null, members: [] as Runner[] };
  const members = await db.select().from(runners).where(eq(runners.crewId, runner.crewId));
  return { crew: crewRows[0], members };
}

export async function joinCrew(runner: Runner, rawCode: string) {
  const db = await requireDb();
  const code = rawCode.trim().toUpperCase();
  if (code.length < 4) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "초대 코드를 정확히 입력해 주세요." });
  }
  const rows = await db.select().from(crews).where(eq(crews.code, code)).limit(1);
  const crew = rows[0];
  if (!crew) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "해당 코드의 크루를 찾지 못했습니다. 코드를 다시 확인해 주세요.",
    });
  }
  if (runner.crewId === crew.id) {
    return { crew: { id: crew.id, name: crew.name, code: crew.code }, alreadyMember: true };
  }
  await db.update(runners).set({ crewId: crew.id }).where(eq(runners.id, runner.id));
  return { crew: { id: crew.id, name: crew.name, code: crew.code }, alreadyMember: false };
}

export async function createCrew(
  runner: Runner,
  input: { name: string; weeklyGoalKm: number },
) {
  const db = await requireDb();
  let code = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    code = Array.from({ length: 6 }, () =>
      CREW_CODE_ALPHABET.charAt(Math.floor(Math.random() * CREW_CODE_ALPHABET.length)),
    ).join("");
    const existing = await db.select({ id: crews.id }).from(crews).where(eq(crews.code, code));
    if (existing.length === 0) break;
    code = "";
  }
  if (!code) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "초대 코드를 만들지 못했습니다. 다시 시도해 주세요.",
    });
  }

  await db.insert(crews).values({
    code,
    name: input.name.trim().slice(0, 30),
    weeklyGoalM: Math.round(input.weeklyGoalKm * 1000),
    ownerRunnerId: runner.id,
  });
  const created = (await db.select().from(crews).where(eq(crews.code, code)).limit(1))[0];
  await db.update(runners).set({ crewId: created.id }).where(eq(runners.id, runner.id));

  return { crew: { id: created.id, name: created.name, code: created.code } };
}

export async function leaveCrew(runner: Runner) {
  const db = await requireDb();
  await db.update(runners).set({ crewId: null }).where(eq(runners.id, runner.id));
  return { success: true } as const;
}

export async function getCrewOverview(runner: Runner) {
  const db = await requireDb();
  await ensureDemoData();
  const { crew, members } = await loadCrewContext(runner);
  if (!crew) {
    return { crew: null, week: [], month: [], feed: [], weekTotalM: 0, monthTotalM: 0 };
  }

  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const recentStart = monday < monthStart ? monday : monthStart;
  const memberIds = members.map(member => member.id);

  const recentRuns = await db
    .select()
    .from(runs)
    .where(and(inArray(runs.runnerId, memberIds), gte(runs.dateKey, recentStart)))
    .orderBy(desc(runs.startedAt));

  const week = buildMemberStats(
    members,
    recentRuns.filter(row => row.dateKey >= monday),
    runner.id,
  );
  const monthRuns = recentRuns.filter(row => row.dateKey >= monthStart);
  const month = buildMemberStats(members, monthRuns, runner.id);

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

/* ------------------------------------------------------------------ */
/* 러닝 기록                                                            */
/* ------------------------------------------------------------------ */

export async function logRun(
  runner: Runner,
  input: { distanceM: number; durationSec: number; startedAt: string; note?: string },
) {
  const db = await requireDb();
  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간이 올바르지 않습니다." });
  }
  const dateKey = dateKeyOf(startedAt);

  await db.insert(runs).values({
    runnerId: runner.id,
    distanceM: Math.round(input.distanceM),
    durationSec: Math.round(input.durationSec),
    startedAt,
    dateKey,
    note: input.note?.trim().slice(0, 140) || null,
    source: "manual",
  });

  return { success: true, dateKey };
}

export async function deleteRun(runner: Runner, runId: number) {
  const db = await requireDb();
  const rows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!rows[0] || rows[0].runnerId !== runner.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "기록을 찾을 수 없습니다." });
  }
  await db.delete(runs).where(eq(runs.id, runId));
  return { success: true } as const;
}

export async function listRuns(runner: Runner, limit = 20) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(runs)
    .where(eq(runs.runnerId, runner.id))
    .orderBy(desc(runs.startedAt))
    .limit(limit);
  return rows.map(row => ({
    id: row.id,
    distanceM: row.distanceM,
    durationSec: row.durationSec,
    paceSec: row.distanceM > 0 ? Math.round(row.durationSec / (row.distanceM / 1000)) : 0,
    startedAt: row.startedAt,
    dateKey: row.dateKey,
    note: row.note,
  }));
}

/* ------------------------------------------------------------------ */
/* 대시보드 / 목표 / 밸런스                                              */
/* ------------------------------------------------------------------ */

function parseBaseline(json: string | null): Partial<Record<BodyPart, number>> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const result: Partial<Record<BodyPart, number>> = {};
    for (const part of BODY_PARTS) {
      const value = parsed[part.key];
      if (typeof value === "number" && Number.isFinite(value)) {
        result[part.key] = Math.max(0, Math.min(14, value));
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function loadBalance(runner: Runner, todayKey: string): Promise<BalanceResult> {
  const db = await requireDb();
  const since = addDays(todayKey, -29);
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.runnerId, runner.id), gte(workoutLogs.dateKey, since)));

  return computeBalance(
    logs.map(log => ({
      bodyPart: log.bodyPart,
      sets: log.sets,
      reps: log.reps,
      weightKg: log.weightKg,
      durationMin: log.durationMin,
      dateKey: log.dateKey,
    })),
    parseBaseline(runner.baselineJson),
    todayKey,
  );
}

async function loadActiveDays(runner: Runner, todayKey: string): Promise<string[]> {
  const db = await requireDb();
  const since = addDays(todayKey, -180);
  const [runRows, workoutRows] = await Promise.all([
    db
      .select({ dateKey: runs.dateKey })
      .from(runs)
      .where(and(eq(runs.runnerId, runner.id), gte(runs.dateKey, since))),
    db
      .select({ dateKey: workoutLogs.dateKey })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.runnerId, runner.id), gte(workoutLogs.dateKey, since))),
  ]);
  return [...new Set([...runRows, ...workoutRows].map(row => row.dateKey))];
}

export async function getDashboard(runner: Runner) {
  const db = await requireDb();
  await ensureDemoData();
  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);
  const { crew, members } = await loadCrewContext(runner);
  const memberIds = members.length > 0 ? members.map(member => member.id) : [runner.id];

  const [myRuns, weekCrewRuns, workoutRows, activeDays] = await Promise.all([
    db
      .select()
      .from(runs)
      .where(eq(runs.runnerId, runner.id))
      .orderBy(desc(runs.startedAt))
      .limit(40),
    db
      .select()
      .from(runs)
      .where(and(inArray(runs.runnerId, memberIds), gte(runs.dateKey, monday))),
    db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.runnerId, runner.id), gte(workoutLogs.dateKey, addDays(todayKey, -29)))),
    loadActiveDays(runner, todayKey),
  ]);

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
    parseBaseline(runner.baselineJson),
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
    recentRuns: myRuns.slice(0, 4).map(row => ({
      id: row.id,
      distanceM: row.distanceM,
      durationSec: row.durationSec,
      paceSec: row.distanceM > 0 ? Math.round(row.durationSec / (row.distanceM / 1000)) : 0,
      startedAt: row.startedAt,
      dateKey: row.dateKey,
      note: row.note,
    })),
    balance,
    routine,
    summary: {
      todayLabel: `${formatKm(todayDistanceM)}km`,
      weekLabel: `${formatKm(weekDistanceM)}km`,
    },
  };
}

export async function getGoals(runner: Runner) {
  const db = await requireDb();
  const todayKey = dateKeyOf(new Date());
  const monday = weekStart(todayKey);

  const [myRuns, workoutRows] = await Promise.all([
    db
      .select()
      .from(runs)
      .where(eq(runs.runnerId, runner.id))
      .orderBy(desc(runs.startedAt))
      .limit(500),
    db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.runnerId, runner.id), gte(workoutLogs.dateKey, addDays(todayKey, -180)))),
  ]);

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

export async function getBalanceOverview(runner: Runner) {
  const db = await requireDb();
  const todayKey = dateKeyOf(new Date());
  const [balance, logs] = await Promise.all([
    loadBalance(runner, todayKey),
    db
      .select()
      .from(workoutLogs)
      .where(eq(workoutLogs.runnerId, runner.id))
      .orderBy(desc(workoutLogs.createdAt))
      .limit(12),
  ]);

  return {
    runner: toPublicRunner(runner),
    balance,
    routine: buildRoutine(balance),
    logs: logs.map(log => ({
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
    })),
    threshold: 4,
  };
}

export async function logWorkout(
  runner: Runner,
  input: {
    bodyPart: string;
    exerciseSlug: string;
    sets: number;
    reps: number;
    weightKg: number;
    durationMin: number;
    dateKey?: string;
  },
) {
  const db = await requireDb();
  if (!isBodyPart(input.bodyPart)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "운동 부위를 선택해 주세요." });
  }
  const exercise = findExercise(input.exerciseSlug);
  if (!exercise) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "운동 종목을 찾을 수 없습니다." });
  }
  const todayKey = dateKeyOf(new Date());
  const dateKey = input.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ? input.dateKey : todayKey;

  await db.insert(workoutLogs).values({
    runnerId: runner.id,
    bodyPart: input.bodyPart,
    exerciseSlug: exercise.slug,
    exerciseName: exercise.name,
    sets: Math.round(input.sets),
    reps: Math.round(input.reps),
    weightKg: Math.round(input.weightKg),
    durationMin: Math.round(input.durationMin),
    dateKey,
  });

  return { success: true, dateKey };
}

export async function deleteWorkout(runner: Runner, logId: number) {
  const db = await requireDb();
  const rows = await db.select().from(workoutLogs).where(eq(workoutLogs.id, logId)).limit(1);
  if (!rows[0] || rows[0].runnerId !== runner.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "운동 기록을 찾을 수 없습니다." });
  }
  await db.delete(workoutLogs).where(eq(workoutLogs.id, logId));
  return { success: true } as const;
}

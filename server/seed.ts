import { and, eq, gte, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { crews, runners, runs } from "../../drizzle/schema";
import { addDays, dateKeyOf, DEMO_CREW_CODE } from "../../shared/fitness";
import { getDb } from "../db";

type DemoRunner = {
  handle: string;
  nickname: string;
  avatar: string;
  weekdays: number[];
  baseKm: number;
  basePaceSec: number;
  notes: string[];
};

const DEMO_RUNNERS: DemoRunner[] = [
  {
    handle: "seed-hana",
    nickname: "김하나",
    avatar: "🐰",
    weekdays: [1, 3, 5, 6],
    baseKm: 7.4,
    basePaceSec: 318,
    notes: ["한강 10K, 다리 가볍다", "아침 공기 좋아서 한 바퀴 더", "오늘은 천천히 회복주"],
  },
  {
    handle: "seed-doyun",
    nickname: "이도윤",
    avatar: "🐯",
    weekdays: [0, 2, 4, 6],
    baseKm: 9.1,
    basePaceSec: 342,
    notes: ["인터벌 400m × 8 완료", "퇴근런. 마지막 2km는 질주", "주말 장거리 15K"],
  },
  {
    handle: "seed-seoyeon",
    nickname: "박서연",
    avatar: "🦊",
    weekdays: [1, 2, 4, 5],
    baseKm: 6.0,
    basePaceSec: 366,
    notes: ["5K 페이스 체크", "비 와서 짧게", "러닝 후 스쿼트까지"],
  },
  {
    handle: "seed-minjun",
    nickname: "최민준",
    avatar: "🐻",
    weekdays: [0, 3, 5],
    baseKm: 11.2,
    basePaceSec: 301,
    notes: ["20K 롱런", "페이스 5분 10초 유지", "오늘은 언덕 위주로"],
  },
  {
    handle: "seed-yujin",
    nickname: "정유진",
    avatar: "🐧",
    weekdays: [2, 4, 6],
    baseKm: 5.1,
    basePaceSec: 388,
    notes: ["처음으로 5K 완주", "천천히 30분", "주말 아침 러닝"],
  },
];

const SEED_DAYS = 26;

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

async function ensureCrew() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const existing = await db
    .select()
    .from(crews)
    .where(eq(crews.code, DEMO_CREW_CODE))
    .limit(1);
  if (existing.length > 0) return existing[0];

  await db
    .insert(crews)
    .values({
      code: DEMO_CREW_CODE,
      name: "한강 새벽런",
      weeklyGoalM: 140000,
      isDemo: 1,
    })
    .onDuplicateKeyUpdate({ set: { name: "한강 새벽런" } });

  const created = await db
    .select()
    .from(crews)
    .where(eq(crews.code, DEMO_CREW_CODE))
    .limit(1);
  return created[0];
}

async function runSeed(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const crew = await ensureCrew();
  if (!crew) return;

  const todayKey = dateKeyOf(new Date());
  const earliest = addDays(todayKey, -(SEED_DAYS + 1));

  for (const demo of DEMO_RUNNERS) {
    let runnerRow = (
      await db.select().from(runners).where(eq(runners.handle, demo.handle)).limit(1)
    )[0];

    if (!runnerRow) {
      await db.insert(runners).values({
        handle: demo.handle,
        token: nanoid(32),
        nickname: demo.nickname,
        avatar: demo.avatar,
        crewId: crew.id,
        dailyGoalM: Math.round(demo.baseKm * 1000),
        dailyGoalMin: 40,
        weeklyGoalM: 30000,
        isDemo: 1,
      });
      runnerRow = (
        await db.select().from(runners).where(eq(runners.handle, demo.handle)).limit(1)
      )[0];
    } else if (runnerRow.crewId !== crew.id) {
      await db.update(runners).set({ crewId: crew.id }).where(eq(runners.id, runnerRow.id));
    }

    if (!runnerRow) continue;

    const existing = await db
      .select({ dateKey: runs.dateKey })
      .from(runs)
      .where(and(eq(runs.runnerId, runnerRow.id), gte(runs.dateKey, earliest)));
    const taken = new Set(existing.map(row => row.dateKey));

    const rows: (typeof runs.$inferInsert)[] = [];
    for (let offset = 0; offset <= SEED_DAYS; offset += 1) {
      const dateKey = addDays(todayKey, -offset);
      if (taken.has(dateKey)) continue;
      const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if (!demo.weekdays.includes(weekday)) continue;
      if (hash(`${demo.handle}:${dateKey}:on`) > 0.86) continue;

      const distanceKm = Number(
        (demo.baseKm * (0.78 + hash(`${demo.handle}:${dateKey}:d`) * 0.55)).toFixed(1),
      );
      const paceSec = Math.round(
        demo.basePaceSec + (hash(`${demo.handle}:${dateKey}:p`) - 0.5) * 46,
      );
      const durationSec = Math.round(distanceKm * paceSec);
      const hour = 6 + Math.floor(hash(`${demo.handle}:${dateKey}:h`) * 3);
      const minute = Math.floor(hash(`${demo.handle}:${dateKey}:m`) * 60);
      const noteIndex = Math.floor(hash(`${demo.handle}:${dateKey}:n`) * (demo.notes.length + 1));
      const note = demo.notes[noteIndex] ?? null;

      rows.push({
        runnerId: runnerRow.id,
        distanceM: Math.round(distanceKm * 1000),
        durationSec,
        startedAt: new Date(
          `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`,
        ),
        dateKey,
        note,
        source: "seed",
      });
    }

    if (rows.length > 0) {
      await db.insert(runs).values(rows);
    }
  }
}

let seedPromise: Promise<void> | null = null;
let lastSeedAt = 0;
const SEED_TTL_MS = 6 * 60 * 60 * 1000;

/** 데모 크루/기록을 준비한다. 6시간마다 새 기록을 채워 랭킹이 살아 있게 유지한다. */
export function ensureDemoData(): Promise<void> {
  const now = Date.now();
  if (seedPromise && now - lastSeedAt < SEED_TTL_MS) return seedPromise;
  lastSeedAt = now;
  seedPromise = runSeed().catch(error => {
    seedPromise = null;
    console.error("[Seed] Failed to prepare demo data:", error);
  });
  return seedPromise;
}

/** 데모 크루 정보(코드/이름)를 조회한다. */
export async function getDemoCrew() {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(crews)
    .where(inArray(crews.code, [DEMO_CREW_CODE]))
    .limit(1);
  return rows[0];
}

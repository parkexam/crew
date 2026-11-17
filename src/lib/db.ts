/**
 * 발맞춤 로컬 데이터 스토어.
 *
 * 원래 서버(express + tRPC + MySQL)에 있던 모델을 그대로 옮겨
 * 기기(localStorage) 안에서 동일한 형태로 동작하게 한다.
 * 새로고침해도 러너 계정, 러닝 기록, 운동 기록, 크루가 유지된다.
 */
import { addDays, dateKeyOf, DEMO_CREW_CODE, type BodyPart } from "@shared/fitness";

const STORAGE_KEY = "balmatchum.db.v1";

export type RunnerRow = {
  id: number;
  handle: string;
  token: string;
  nickname: string;
  avatar: string;
  crewId: number | null;
  dailyGoalM: number;
  dailyGoalMin: number;
  weeklyGoalM: number;
  /** 온보딩 설문에서 받은 부위별 최근 2주 운동 횟수 */
  baseline: Partial<Record<BodyPart, number>> | null;
  isDemo: number;
  createdAt: string;
};

export type CrewRow = {
  id: number;
  code: string;
  name: string;
  weeklyGoalM: number;
  ownerRunnerId: number | null;
  isDemo: number;
  createdAt: string;
};

export type RunRow = {
  id: number;
  runnerId: number;
  distanceM: number;
  durationSec: number;
  startedAt: string;
  dateKey: string;
  note: string | null;
  source: string;
  createdAt: string;
};

export type WorkoutRow = {
  id: number;
  runnerId: number;
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

export type DB = {
  version: 1;
  runners: RunnerRow[];
  crews: CrewRow[];
  runs: RunRow[];
  workoutLogs: WorkoutRow[];
  seq: { runner: number; crew: number; run: number; workout: number };
  seededDay: string | null;
};

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

function emptyDb(): DB {
  return {
    version: 1,
    runners: [],
    crews: [],
    runs: [],
    workoutLogs: [],
    seq: { runner: 0, crew: 0, run: 0, workout: 0 },
    seededDay: null,
  };
}

function normalize(raw: Partial<DB>): DB {
  const base = emptyDb();
  return {
    version: 1,
    runners: Array.isArray(raw.runners) ? raw.runners : base.runners,
    crews: Array.isArray(raw.crews) ? raw.crews : base.crews,
    runs: Array.isArray(raw.runs) ? raw.runs : base.runs,
    workoutLogs: Array.isArray(raw.workoutLogs) ? raw.workoutLogs : base.workoutLogs,
    seq: { ...base.seq, ...(raw.seq ?? {}) },
    seededDay: typeof raw.seededDay === "string" ? raw.seededDay : null,
  };
}

let cache: DB | null = null;
const listeners = new Set<() => void>();

function persist(db: DB): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 저장 공간을 쓸 수 없어도 메모리 상태로는 계속 동작한다.
  }
}

function load(): DB {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DB>;
      if (parsed && parsed.version === 1) return normalize(parsed);
    }
  } catch {
    // 깨진 저장값은 새로 시작한다.
  }
  return emptyDb();
}

export function notify(): void {
  listeners.forEach(listener => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 데모 크루와 지난 4주 러닝 기록을 채워 랭킹이 살아 있게 유지한다. */
function ensureDemoData(db: DB): boolean {
  const todayKey = dateKeyOf(new Date());
  let changed = false;

  let demoCrew = db.crews.find(crew => crew.code === DEMO_CREW_CODE);
  if (!demoCrew) {
    db.seq.crew += 1;
    demoCrew = {
      id: db.seq.crew,
      code: DEMO_CREW_CODE,
      name: "한강 새벽런",
      weeklyGoalM: 140000,
      ownerRunnerId: null,
      isDemo: 1,
      createdAt: new Date().toISOString(),
    };
    db.crews.push(demoCrew);
    changed = true;
  }

  for (const demo of DEMO_RUNNERS) {
    let runner = db.runners.find(row => row.handle === demo.handle);
    if (!runner) {
      db.seq.runner += 1;
      runner = {
        id: db.seq.runner,
        handle: demo.handle,
        token: `seed_${demo.handle}`,
        nickname: demo.nickname,
        avatar: demo.avatar,
        crewId: demoCrew.id,
        dailyGoalM: Math.round(demo.baseKm * 1000),
        dailyGoalMin: 40,
        weeklyGoalM: 30000,
        baseline: null,
        isDemo: 1,
        createdAt: new Date().toISOString(),
      };
      db.runners.push(runner);
      changed = true;
    } else if (runner.crewId !== demoCrew.id) {
      runner.crewId = demoCrew.id;
      changed = true;
    }
  }

  if (db.seededDay === todayKey) return changed;

  const taken = new Set(
    db.runs.filter(run => run.source === "seed").map(run => `${run.runnerId}:${run.dateKey}`),
  );

  for (const demo of DEMO_RUNNERS) {
    const runner = db.runners.find(row => row.handle === demo.handle);
    if (!runner) continue;

    for (let offset = 0; offset <= SEED_DAYS; offset += 1) {
      const dateKey = addDays(todayKey, -offset);
      if (taken.has(`${runner.id}:${dateKey}`)) continue;
      const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if (!demo.weekdays.includes(weekday)) continue;
      if (hash(`${demo.handle}:${dateKey}:on`) > 0.86) continue;

      const distanceKm = Number(
        (demo.baseKm * (0.78 + hash(`${demo.handle}:${dateKey}:d`) * 0.55)).toFixed(1),
      );
      const paceSec = Math.round(demo.basePaceSec + (hash(`${demo.handle}:${dateKey}:p`) - 0.5) * 46);
      const durationSec = Math.round(distanceKm * paceSec);
      const hour = 6 + Math.floor(hash(`${demo.handle}:${dateKey}:h`) * 3);
      const minute = Math.floor(hash(`${demo.handle}:${dateKey}:m`) * 60);
      const noteIndex = Math.floor(hash(`${demo.handle}:${dateKey}:n`) * (demo.notes.length + 1));
      const note = demo.notes[noteIndex] ?? null;

      db.seq.run += 1;
      db.runs.push({
        id: db.seq.run,
        runnerId: runner.id,
        distanceM: Math.round(distanceKm * 1000),
        durationSec,
        startedAt: new Date(
          `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`,
        ).toISOString(),
        dateKey,
        note,
        source: "seed",
        createdAt: new Date().toISOString(),
      });
      taken.add(`${runner.id}:${dateKey}`);
      changed = true;
    }
  }

  db.seededDay = todayKey;
  return true;
}

export function getDb(): DB {
  if (!cache) {
    cache = load();
    if (ensureDemoData(cache)) persist(cache);
  }
  return cache;
}

/** 스토어를 바꾸고 구독자에게 알린다. fn의 반환값을 그대로 돌려준다. */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = getDb();
  const result = fn(db);
  persist(db);
  notify();
  return result;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      notify();
    }
  });
}

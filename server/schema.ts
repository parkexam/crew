import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** 러닝 크루. 6자리 초대 코드로 참여한다. */
export const crews = mysqlTable("crews", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  /** 크루 전체의 주간 목표 거리(m) */
  weeklyGoalM: int("weeklyGoalM").notNull().default(120000),
  ownerRunnerId: int("ownerRunnerId"),
  isDemo: int("isDemo").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Crew = typeof crews.$inferSelect;

/** 앱 사용자(러너). 기기 토큰 기반의 가벼운 세션을 사용한다. */
export const runners = mysqlTable(
  "runners",
  {
    id: int("id").autoincrement().primaryKey(),
    handle: varchar("handle", { length: 40 }).notNull().unique(),
    token: varchar("token", { length: 64 }).notNull(),
    nickname: varchar("nickname", { length: 24 }).notNull(),
    avatar: varchar("avatar", { length: 8 }).notNull().default("🐰"),
    crewId: int("crewId"),
    dailyGoalM: int("dailyGoalM").notNull().default(5000),
    dailyGoalMin: int("dailyGoalMin").notNull().default(30),
    weeklyGoalM: int("weeklyGoalM").notNull().default(25000),
    /** 온보딩 설문에서 받은 부위별 최근 2주 운동 횟수(JSON) */
    baselineJson: text("baselineJson"),
    isDemo: int("isDemo").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  (table) => [index("idx_runners_crew").on(table.crewId)],
);

export type Runner = typeof runners.$inferSelect;

/** 러닝 기록. dateKey는 Asia/Seoul 기준 YYYY-MM-DD. */
export const runs = mysqlTable(
  "runs",
  {
    id: int("id").autoincrement().primaryKey(),
    runnerId: int("runnerId").notNull(),
    distanceM: int("distanceM").notNull(),
    durationSec: int("durationSec").notNull(),
    startedAt: timestamp("startedAt").notNull(),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    note: varchar("note", { length: 140 }),
    source: varchar("source", { length: 16 }).notNull().default("manual"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("idx_runs_runner_date").on(table.runnerId, table.dateKey),
    index("idx_runs_date").on(table.dateKey),
  ],
);

export type Run = typeof runs.$inferSelect;

/** 부위별 근력 운동 기록. */
export const workoutLogs = mysqlTable(
  "workoutLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    runnerId: int("runnerId").notNull(),
    bodyPart: varchar("bodyPart", { length: 16 }).notNull(),
    exerciseSlug: varchar("exerciseSlug", { length: 64 }).notNull(),
    exerciseName: varchar("exerciseName", { length: 64 }).notNull(),
    sets: int("sets").notNull().default(3),
    reps: int("reps").notNull().default(10),
    weightKg: int("weightKg").notNull().default(0),
    durationMin: int("durationMin").notNull().default(0),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("idx_workout_runner_date").on(table.runnerId, table.dateKey),
    index("idx_workout_part").on(table.runnerId, table.bodyPart),
  ],
);

export type WorkoutLog = typeof workoutLogs.$inferSelect;

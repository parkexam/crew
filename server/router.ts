import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { authenticateRunner } from "./service";
import * as service from "./service";

/** 기기 토큰 기반 러너 세션이 필요한 프로시저 */
const runnerProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const runner = await authenticateRunner(ctx.req);
  if (!runner) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "RUNNER_REQUIRED" });
  }
  return next({ ctx: { ...ctx, runner } });
});

const baselineSchema = z.record(z.string(), z.number().min(0).max(14));

export const fitnessRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    const runner = await authenticateRunner(ctx.req);
    if (!runner) return null;
    return service.getSessionPayload(runner);
  }),

  createSession: publicProcedure
    .input(
      z.object({
        nickname: z.string().trim().min(1, "닉네임을 입력해 주세요.").max(12),
        avatar: z.string().min(1).max(8),
        dailyGoalM: z.number().int().min(1000).max(50000),
        dailyGoalMin: z.number().int().min(5).max(300),
        baseline: baselineSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => service.createRunner(input)),

  updateProfile: runnerProcedure
    .input(
      z.object({
        nickname: z.string().trim().min(1).max(12).optional(),
        avatar: z.string().min(1).max(8).optional(),
        baseline: baselineSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => service.updateProfile(ctx.runner, input)),

  setGoals: runnerProcedure
    .input(
      z.object({
        dailyGoalM: z.number().int().min(500).max(50000).optional(),
        dailyGoalMin: z.number().int().min(5).max(300).optional(),
        weeklyGoalM: z.number().int().min(1000).max(300000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => service.setGoals(ctx.runner, input)),

  dashboard: runnerProcedure.query(async ({ ctx }) => service.getDashboard(ctx.runner)),

  crew: router({
    overview: runnerProcedure.query(async ({ ctx }) => service.getCrewOverview(ctx.runner)),
    join: runnerProcedure
      .input(z.object({ code: z.string().trim().min(4).max(12) }))
      .mutation(async ({ ctx, input }) => service.joinCrew(ctx.runner, input.code)),
    create: runnerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "크루 이름을 입력해 주세요.").max(30),
          weeklyGoalKm: z.number().min(10).max(1000),
        }),
      )
      .mutation(async ({ ctx, input }) => service.createCrew(ctx.runner, input)),
    leave: runnerProcedure.mutation(async ({ ctx }) => service.leaveCrew(ctx.runner)),
  }),

  run: router({
    log: runnerProcedure
      .input(
        z.object({
          distanceM: z.number().min(50).max(150000),
          durationSec: z.number().min(10).max(86400),
          startedAt: z.string().min(10),
          note: z.string().max(140).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => service.logRun(ctx.runner, input)),
    list: runnerProcedure
      .input(z.object({ limit: z.number().int().min(1).max(60).optional() }).optional())
      .query(async ({ ctx, input }) => service.listRuns(ctx.runner, input?.limit ?? 20)),
    remove: runnerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => service.deleteRun(ctx.runner, input.id)),
  }),

  goals: router({
    overview: runnerProcedure.query(async ({ ctx }) => service.getGoals(ctx.runner)),
  }),

  balance: router({
    overview: runnerProcedure.query(async ({ ctx }) => service.getBalanceOverview(ctx.runner)),
    logWorkout: runnerProcedure
      .input(
        z.object({
          bodyPart: z.string().min(1),
          exerciseSlug: z.string().min(1),
          sets: z.number().int().min(1).max(20),
          reps: z.number().int().min(1).max(100),
          weightKg: z.number().int().min(0).max(300).default(0),
          durationMin: z.number().int().min(0).max(180).default(0),
          dateKey: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => service.logWorkout(ctx.runner, input)),
    removeWorkout: runnerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => service.deleteWorkout(ctx.runner, input.id)),
  }),
});

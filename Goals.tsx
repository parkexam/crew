import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Flame, Loader2, Pencil, Trash2, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import { ActivityCalendar } from "@/components/ActivityCalendar";
import { ProgressRing } from "@/components/ProgressRing";
import { Sheet } from "@/components/Sheet";
import {
  ErrorState,
  PageHeader,
  ScreenLoader,
  SectionTitle,
} from "@/components/primitives";
import { RunRow } from "@/components/RunRow";
import {
  formatDuration,
  formatKm,
  formatPace,
  percent,
} from "@shared/fitness";

export default function Goals() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const goals = trpc.fitness.goals.overview.useQuery(undefined, { staleTime: 15_000 });
  const recentRuns = trpc.fitness.run.list.useQuery({ limit: 8 });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [dailyKm, setDailyKm] = useState(5);
  const [dailyMin, setDailyMin] = useState(30);
  const [weeklyKm, setWeeklyKm] = useState(25);
  const [error, setError] = useState<string | null>(null);

  const setGoals = trpc.fitness.setGoals.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.goals.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
        utils.fitness.me.invalidate(),
      ]);
      setEditOpen(false);
    },
    onError: err => setError(err.message),
  });

  const deleteRun = trpc.fitness.run.remove.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.goals.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
        utils.fitness.run.list.invalidate(),
        utils.fitness.crew.overview.invalidate(),
      ]);
      setDeleteTarget(null);
    },
  });

  if (goals.isLoading) {
    return (
      <AppShell>
        <PageHeader title="목표" eyebrow="Goals" />
        <ScreenLoader label="목표 기록을 불러오는 중" />
      </AppShell>
    );
  }

  if (goals.isError || !goals.data) {
    return (
      <AppShell>
        <PageHeader title="목표" eyebrow="Goals" />
        <ErrorState message={goals.error?.message} onRetry={() => goals.refetch()} />
      </AppShell>
    );
  }

  const data = goals.data;
  const { runner, today, week, streak, totals, calendar } = data;
  const openEditor = () => {
    setDailyKm(Math.round(runner.dailyGoalM / 1000));
    setDailyMin(runner.dailyGoalMin);
    setWeeklyKm(Math.round(runner.weeklyGoalM / 1000));
    setError(null);
    setEditOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="목표"
        eyebrow="Goals"
        right={
          <button
            type="button"
            onClick={openEditor}
            className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[10px] font-bold text-ink-soft"
          >
            <Pencil size={11} /> 목표 수정
          </button>
        }
      />

      <div className="px-5 pb-6 pt-4">
        <section className="overflow-hidden rounded-[4px] bg-ink px-5 py-5 text-paper">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-paper/45">
                Today
              </p>
              <p className="mt-1 text-[12px] font-semibold text-paper/70">
                {formatKm(runner.dailyGoalM, 0)}km · {runner.dailyGoalMin}분 목표
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-track/40 bg-track/15 px-2.5 py-1 text-[10px] font-bold text-track">
              <Flame size={11} strokeWidth={2.6} /> {streak.current}일
            </span>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <ProgressRing
              value={today.pct}
              size={142}
              stroke={10}
              color="var(--accent)"
              track="rgba(243,239,229,0.14)"
            >
              <span className="display text-[38px] leading-none">{formatKm(today.distanceM)}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-paper/45">
                of {formatKm(runner.dailyGoalM, 0)} km
              </span>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  오늘 시간
                </p>
                <p className="display mt-0.5 text-[22px]">{formatDuration(today.durationSec)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  남은 거리
                </p>
                <p className="display mt-0.5 text-[22px]">
                  {formatKm(Math.max(0, runner.dailyGoalM - today.distanceM))}
                  <span className="ml-1 text-[9px] font-sans font-bold text-paper/40">km</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/run")}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-full bg-track py-2.5 text-[11px] font-extrabold text-white"
              >
                지금 달리기 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </section>

        <section className="card mt-3 px-4 py-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="label">주간 목표</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="display text-[26px]">{formatKm(week.distanceM)}</span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  / {formatKm(week.goalM, 0)} km
                </span>
              </p>
            </div>
            <span className="display text-[22px] text-track">{week.pct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-track transition-all"
              style={{ width: `${week.pct}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            주간 목표까지 {formatKm(Math.max(0, week.goalM - week.distanceM))}km 남았어요. 하루{" "}
            {formatKm(Math.max(0, week.goalM - week.distanceM) / 7)}km씩이면 채울 수 있어요.
          </p>
        </section>

        <section className="mt-6">
          <SectionTitle
            title="활동 캘린더"
            caption="최근 12주 · 진한 색일수록 멀리 달렸어요"
            right={
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-paper-deep" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-track/25" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-track/50" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-track" />
              </div>
            }
          />
          <div className="card px-4 py-4">
            <ActivityCalendar days={calendar} />
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[10px] text-muted-foreground">
              <span>러닝 {totals.runCount}회</span>
              <span>활동일 {totals.activeDays}일</span>
              <span>총 {formatKm(totals.distanceM)}km</span>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle title="연속 기록" caption="러닝 또는 근력 운동을 기록한 날 기준" />
          <div className="grid grid-cols-2 gap-2">
            <div className="card px-4 py-4">
              <div className="flex items-center gap-1.5">
                <Flame size={13} className="text-track" />
                <span className="label">현재</span>
              </div>
              <p className="display mt-2 text-[34px]">
                {streak.current}
                <span className="ml-1 text-[11px] font-sans font-bold text-muted-foreground">일</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {streak.current > 0 ? "오늘도 이어가 볼까요" : "오늘부터 다시 시작"}
              </p>
            </div>
            <div className="card px-4 py-4">
              <div className="flex items-center gap-1.5">
                <Trophy size={13} className="text-gold" />
                <span className="label">최고</span>
              </div>
              <p className="display mt-2 text-[34px]">
                {streak.best}
                <span className="ml-1 text-[11px] font-sans font-bold text-muted-foreground">일</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">개인 최장 연속 기록</p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle title="개인 기록" caption="지금까지 쌓인 숫자" />
          <div className="grid grid-cols-2 gap-2">
            <div className="card px-4 py-3.5">
              <p className="label">누적 거리</p>
              <p className="display mt-1.5 text-[24px]">
                {formatKm(totals.distanceM)}
                <span className="ml-1 text-[9px] font-sans font-bold text-muted-foreground">km</span>
              </p>
            </div>
            <div className="card px-4 py-3.5">
              <p className="label">누적 시간</p>
              <p className="display mt-1.5 text-[24px]">
                {Math.floor(totals.durationSec / 3600)}
                <span className="ml-0.5 text-[14px]">h</span>{" "}
                {Math.floor((totals.durationSec % 3600) / 60)}
                <span className="ml-0.5 text-[14px]">m</span>
              </p>
            </div>
            <div className="card px-4 py-3.5">
              <p className="label">최장 거리</p>
              <p className="display mt-1.5 text-[24px]">
                {formatKm(totals.longestM)}
                <span className="ml-1 text-[9px] font-sans font-bold text-muted-foreground">km</span>
              </p>
            </div>
            <div className="card px-4 py-3.5">
              <p className="label">최고 페이스</p>
              <p className="display mt-1.5 text-[24px]">
                {formatPace(totals.bestPaceSec)}
                <span className="ml-1 text-[9px] font-sans font-bold text-muted-foreground">/km</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle
            title="최근 기록"
            caption="불필요한 기록은 삭제할 수 있어요"
            right={
              <span className="text-[10px] text-muted-foreground">
                {formatKm(totals.distanceM)}km 누적
              </span>
            }
          />
          <div className="card px-4">
            {recentRuns.data && recentRuns.data.length > 0 ? (
              recentRuns.data.map(run => (
                <div key={run.id} className="flex items-center gap-2 border-b border-line/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <RunRow run={run} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(run.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-paper-deep hover:text-destructive"
                    aria-label="기록 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-[11px] text-muted-foreground">
                아직 기록이 없어요.
              </p>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-[9px] leading-relaxed text-muted-foreground">
          연속 기록은 하루에 한 번, 러닝이나 근력 운동을 기록하면 유지됩니다.
          <br />
          하루 목표 달성률은 거리 기준으로 계산해요.
        </p>
      </div>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="목표 수정"
        description="너무 높게 잡으면 지치기 쉬워요. 지킬 수 있는 숫자로 시작하세요."
      >
        <div>
          <span className="label">하루 거리 목표</span>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDailyKm(value => Math.max(1, value - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold"
            >
              −
            </button>
            <div className="flex flex-1 items-baseline justify-center gap-1">
              <span className="display text-[38px]">{dailyKm}</span>
              <span className="text-[11px] font-bold text-muted-foreground">km</span>
            </div>
            <button
              type="button"
              onClick={() => setDailyKm(value => Math.min(50, value + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-5">
          <span className="label">하루 시간 목표</span>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDailyMin(value => Math.max(5, value - 5))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold"
            >
              −
            </button>
            <div className="flex flex-1 items-baseline justify-center gap-1">
              <span className="display text-[38px]">{dailyMin}</span>
              <span className="text-[11px] font-bold text-muted-foreground">분</span>
            </div>
            <button
              type="button"
              onClick={() => setDailyMin(value => Math.min(300, value + 5))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-5">
          <span className="label">주간 거리 목표</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {[15, 25, 40, 60].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setWeeklyKm(option)}
                className={
                  weeklyKm === option
                    ? "rounded-[3px] border border-ink bg-ink py-2.5 text-[12px] font-extrabold text-paper"
                    : "rounded-[3px] border border-line py-2.5 text-[12px] font-extrabold text-ink-soft"
                }
              >
                {option}km
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          지금까지 주간 평균 {formatKm((totals.distanceM / Math.max(1, totals.activeDays)) * 7)}km를
          달렸어요. 무리하지 않는 선에서 정해보세요.
        </p>

        {error ? <p className="mt-3 text-[11px] font-semibold text-destructive">{error}</p> : null}

        <button
          type="button"
          disabled={setGoals.isPending}
          onClick={() => {
            setError(null);
            setGoals.mutate({
              dailyGoalM: dailyKm * 1000,
              dailyGoalMin: dailyMin,
              weeklyGoalM: weeklyKm * 1000,
            });
          }}
          className="btn-primary mt-5 w-full py-3.5"
        >
          {setGoals.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          목표 저장
        </button>
      </Sheet>

      <Sheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="이 기록을 삭제할까요?"
        description="삭제하면 랭킹과 목표 달성률에서도 빠집니다."
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 py-3">
            취소
          </button>
          <button
            type="button"
            onClick={() => deleteTarget !== null && deleteRun.mutate({ id: deleteTarget })}
            className="flex-1 rounded-full bg-destructive px-4 py-3 text-[12px] font-bold text-white"
          >
            {deleteRun.isPending ? "삭제 중" : "삭제"}
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Flame, Play, RotateCcw, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { clearSession, notifySessionChanged } from "@/lib/session";
import { AppShell, BrandMark } from "@/components/AppShell";
import { ProgressRing } from "@/components/ProgressRing";
import { RunRow } from "@/components/RunRow";
import { Sheet } from "@/components/Sheet";
import { Avatar, ErrorState, ScreenLoader, SectionTitle } from "@/components/primitives";
import { cn } from "@/lib/utils";
import {
  dateKeyOf,
  estimateCalories,
  formatDuration,
  formatKm,
  formatPace,
  percent,
  weekdayLabel,
} from "@shared/fitness";

export default function Home() {
  const [, navigate] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const dashboard = trpc.fitness.dashboard.useQuery(undefined, { staleTime: 15_000 });

  if (dashboard.isLoading) {
    return (
      <AppShell>
        <ScreenLoader label="오늘의 기록을 모으는 중" />
      </AppShell>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <AppShell>
        <ErrorState message={dashboard.error?.message} onRetry={() => dashboard.refetch()} />
      </AppShell>
    );
  }

  const data = dashboard.data;
  const { runner, today, weekProgress, week, streak, weekDots, balance, routine } = data;
  const todayPace =
    today.distanceM > 0 ? Math.round(today.durationSec / (today.distanceM / 1000)) : 0;
  const myRank = data.myRank ?? week.find(member => member.isMe)?.rank ?? null;
  const leader = week[0];
  const topThree = week.slice(0, 3);
  const me = week.find(member => member.isMe);
  const meInTop = topThree.some(member => member.isMe);
  const todayLabel = `${Number(dateKeyOf(new Date()).slice(5, 7))}월 ${Number(
    dateKeyOf(new Date()).slice(8, 10),
  )}일 ${weekdayLabel(dateKeyOf(new Date()))}요일`;

  return (
    <AppShell>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/92 px-5 py-3 backdrop-blur-md">
        <BrandMark />
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2"
          aria-label="내 프로필"
        >
          <span className="text-right">
            <span className="block text-[10px] font-bold text-ink">{runner.nickname}</span>
            <span className="block text-[9px] text-muted-foreground">{todayLabel}</span>
          </span>
          <Avatar emoji={runner.avatar} size="sm" />
        </button>
      </header>

      <div className="px-5 pb-6 pt-4">
        <div className="animate-rise">
          <p className="label">Today&apos;s run</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-[1.2] tracking-[-0.05em]">
            {today.distanceM > 0 ? (
              <>
                오늘 <span className="text-track">{formatKm(today.distanceM)}km</span> 채웠어요.
                <br />
                {today.remainingM > 0
                  ? ` ${formatKm(today.remainingM)}km만 더 가볼까요.`
                  : " 목표를 넘겼습니다."}
              </>
            ) : (
              <>
                아직 오늘의 기록이 없어요.
                <br />
                <span className="text-muted-foreground">가볍게 시작해볼까요.</span>
              </>
            )}
          </h1>
        </div>

        <section className="animate-rise mt-4 overflow-hidden rounded-[4px] bg-ink p-5 text-paper">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-paper/45">
                Daily goal
              </p>
              <p className="mt-1 text-[11px] font-semibold text-paper/70">
                {formatKm(today.goalM, 0)}km · {today.goalMin}분
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-track/40 bg-track/15 px-2.5 py-1 text-[10px] font-bold text-track">
              <Flame size={11} strokeWidth={2.6} /> {streak.current}일 연속
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <ProgressRing
              value={today.pct}
              size={148}
              stroke={10}
              color="var(--accent)"
              track="rgba(243,239,229,0.14)"
            >
              <span className="display text-[40px] leading-none text-paper">
                {formatKm(today.distanceM)}
              </span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-paper/45">
                of {formatKm(today.goalM, 0)} km
              </span>
              <span className="mt-1.5 rounded-full bg-track/15 px-2 py-0.5 text-[10px] font-bold text-track">
                {today.pct}%
              </span>
            </ProgressRing>

            <div className="flex-1 space-y-3.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  시간
                </p>
                <p className="display mt-0.5 text-[22px] text-paper">
                  {formatDuration(today.durationSec)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  평균 페이스
                </p>
                <p className="display mt-0.5 text-[22px] text-paper">
                  {formatPace(todayPace)}
                  <span className="ml-1 text-[9px] font-sans font-bold text-paper/40">/km</span>
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  소모 칼로리
                </p>
                <p className="display mt-0.5 text-[22px] text-paper">
                  {estimateCalories(today.distanceM)}
                  <span className="ml-1 text-[9px] font-sans font-bold text-paper/40">kcal</span>
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/run")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-track py-3.5 text-[13px] font-extrabold text-white"
          >
            <Play size={14} fill="currentColor" /> 러닝 시작하기
          </button>
        </section>

        <section className="card animate-rise mt-3 px-4 py-3.5">
          <div className="flex items-end justify-between">
            <div>
              <p className="label">이번 주</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="display text-[26px] text-ink">
                  {formatKm(weekProgress.distanceM)}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  / {formatKm(weekProgress.goalM, 0)} km
                </span>
              </p>
            </div>
            <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold text-ink-soft">
              {weekProgress.pct}% 달성
            </span>
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            {weekDots.map(day => {
              const height = day.isFuture ? 4 : Math.max(4, Math.round(percent(day.distanceM, 12000) * 0.32));
              return (
                <div key={day.dateKey} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-9 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-[2px] transition-all",
                        day.done ? "bg-track" : "bg-line",
                        day.isToday && !day.done && "bg-track/35",
                      )}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-bold",
                      day.isToday ? "text-track" : "text-muted-foreground",
                    )}
                  >
                    {weekdayLabel(day.dateKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle
            title="크루 순위"
            caption={
              leader
                ? `${leader.nickname}님이 이번 주 ${formatKm(leader.distanceM)}km로 앞서 있어요`
                : "크루에 참여하면 순위가 보여요"
            }
            right={
              <button
                type="button"
                onClick={() => navigate("/crew")}
                className="flex items-center gap-0.5 text-[11px] font-bold text-ink-soft"
              >
                전체 <ChevronRight size={13} />
              </button>
            }
          />
          <div className="card overflow-hidden">
            {topThree.map(member => (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-b-0",
                  member.isMe && "bg-track-soft/60",
                )}
              >
                <span
                  className={cn(
                    "display w-5 text-[17px]",
                    member.rank === 1 ? "text-track" : "text-line-strong",
                  )}
                >
                  {member.rank}
                </span>
                <Avatar emoji={member.avatar} size="xs" />
                <span className="flex-1 text-[12px] font-bold text-ink">
                  {member.nickname}
                  {member.isMe ? (
                    <span className="ml-1 text-[9px] font-bold text-track">ME</span>
                  ) : null}
                </span>
                <span className="display text-[17px] text-ink">
                  {formatKm(member.distanceM)}
                  <span className="ml-0.5 text-[9px] font-sans font-bold text-muted-foreground">
                    km
                  </span>
                </span>
              </div>
            ))}
            {!meInTop && me ? (
              <div className="flex items-center gap-3 border-t border-dashed border-line-strong bg-track-soft/60 px-4 py-3">
                <span className="display w-5 text-[17px] text-track">{me.rank}</span>
                <Avatar emoji={me.avatar} size="xs" highlight />
                <span className="flex-1 text-[12px] font-bold text-ink">
                  {me.nickname}
                  <span className="ml-1 text-[9px] font-bold text-track">ME</span>
                </span>
                <span className="display text-[17px] text-ink">
                  {formatKm(me.distanceM)}
                  <span className="ml-0.5 text-[9px] font-sans font-bold text-muted-foreground">
                    km
                  </span>
                </span>
              </div>
            ) : null}
          </div>
          {myRank && leader && !meInTop ? (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Trophy size={11} /> 1위와 {formatKm(Math.max(0, leader.distanceM - (me?.distanceM ?? 0)))}km
              차이 · 남은 기간 {7 - weekDots.filter(day => !day.isFuture).length}일
            </p>
          ) : null}
        </section>

        <section className="mt-6">
          <SectionTitle
            title="부족한 부위"
            caption={
              balance.estimated
                ? "설문 기반 추정 · 운동 4회를 기록하면 정확해져요"
                : `최근 2주 기록 기준 · 밸런스 ${balance.score}점`
            }
            right={
              <button
                type="button"
                onClick={() => navigate("/balance")}
                className="flex items-center gap-0.5 text-[11px] font-bold text-ink-soft"
              >
                분석 <ChevronRight size={13} />
              </button>
            }
          />
          <button
            type="button"
            onClick={() => navigate("/balance")}
            className="card block w-full p-4 text-left"
          >
            <div className="flex items-center gap-4">
              <ProgressRing
                value={balance.score}
                size={78}
                stroke={7}
                color="var(--sage)"
                track="var(--paper-deep)"
              >
                <span className="display text-[22px] text-ink">{balance.score}</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold tracking-[-0.03em] text-ink">
                  {balance.deficits.length > 0
                    ? `${balance.deficits.map(part => part.label).join(" · ")}가 비어 있어요`
                    : "균형이 잘 잡혀 있어요"}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {routine.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {routine.focusLabels.slice(0, 3).map(label => (
                    <span
                      key={label}
                      className="rounded-full border border-line bg-paper px-2 py-0.5 text-[9px] font-bold text-ink-soft"
                    >
                      {label}
                    </span>
                  ))}
                  <span className="rounded-full bg-track px-2 py-0.5 text-[9px] font-bold text-white">
                    {routine.minutes}분 루틴
                  </span>
                </div>
              </div>
            </div>
          </button>
        </section>

        <section className="mt-6">
          <SectionTitle
            title="최근 러닝"
            right={
              <button
                type="button"
                onClick={() => navigate("/goals")}
                className="flex items-center gap-0.5 text-[11px] font-bold text-ink-soft"
              >
                전체 기록 <ChevronRight size={13} />
              </button>
            }
          />
          <div className="card px-4">
            {data.recentRuns.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted-foreground">
                첫 러닝을 기록하면 여기에 쌓여요.
              </p>
            ) : (
              data.recentRuns.map(run => <RunRow key={run.id} run={run} />)
            )}
          </div>
        </section>

        <p className="mt-7 text-center text-[9px] leading-relaxed text-muted-foreground">
          거리와 페이스는 기기 GPS 또는 평균 페이스로 계산됩니다.
          <br />
          칼로리는 체중 65kg 기준 추정치예요.
        </p>
      </div>

      <Sheet
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setConfirmReset(false);
        }}
        title="내 러너 카드"
        description="이 기기에 저장된 계정이에요. 앱 데이터를 지우면 복구할 수 없습니다."
      >
        <div className="flex items-center gap-4">
          <Avatar emoji={runner.avatar} size="lg" />
          <div>
            <p className="text-[18px] font-extrabold tracking-[-0.04em]">{runner.nickname}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {data.crew ? `${data.crew.name} · ${data.crew.memberCount}명` : "소속 크루 없음"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              하루 목표 {formatKm(runner.dailyGoalM, 0)}km / {runner.dailyGoalMin}분 · 주간{" "}
              {formatKm(runner.weeklyGoalM, 0)}km
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[3px] border border-line bg-paper px-3 py-2.5">
            <p className="label">연속</p>
            <p className="display mt-1 text-[20px]">{streak.current}일</p>
          </div>
          <div className="rounded-[3px] border border-line bg-paper px-3 py-2.5">
            <p className="label">이번 주</p>
            <p className="display mt-1 text-[20px]">{formatKm(weekProgress.distanceM)}</p>
          </div>
          <div className="rounded-[3px] border border-line bg-paper px-3 py-2.5">
            <p className="label">크루 순위</p>
            <p className="display mt-1 text-[20px]">{myRank ?? "—"}위</p>
          </div>
        </div>

        {data.crew ? (
          <div className="mt-3 flex items-center justify-between rounded-[3px] border border-dashed border-line-strong px-3 py-2.5">
            <div>
              <p className="label">크루 초대 코드</p>
              <p className="display mt-1 text-[20px] tracking-[0.16em]">{data.crew.code}</p>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(data.crew!.code)}
              className="rounded-full border border-line px-3 py-1.5 text-[10px] font-bold"
            >
              복사
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          {confirmReset ? (
            <div className="rounded-[3px] border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[11px] font-bold text-destructive">
                정말 초기화할까요? 모든 러닝·운동 기록이 사라집니다.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="btn-ghost flex-1 py-2 text-[11px]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    notifySessionChanged();
                    setProfileOpen(false);
                  }}
                  className="flex-1 rounded-full bg-destructive px-4 py-2 text-[11px] font-bold text-white"
                >
                  초기화
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-[11px] font-bold text-muted-foreground"
            >
              <RotateCcw size={12} /> 계정 초기화
            </button>
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}

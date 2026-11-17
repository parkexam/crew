import { BadgeCheck, Check, Gift, Sparkles } from "lucide-react";
import { formatKm } from "@shared/fitness";
import {
  getCrewRewardProgress,
  WEEKLY_CREW_BADGES,
} from "@shared/crew-rewards";

export function CrewMission({
  totalDistanceM,
  weeklyGoalM,
}: {
  totalDistanceM: number;
  weeklyGoalM: number;
}) {
  const progress = getCrewRewardProgress(totalDistanceM, weeklyGoalM);

  return (
    <section
      className="border-t border-line/80 px-4 pb-4 pt-3"
      aria-labelledby="crew-mission-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label flex items-center gap-1">
            <Sparkles size={10} className="text-track" /> 이번 주 공동 미션
          </p>
          <h3
            id="crew-mission-title"
            className="mt-1 text-[12px] font-extrabold text-ink"
          >
            함께 달려 보상을 열어요
          </h3>
        </div>
        <div className="text-right">
          <p className="display text-[18px] text-track">{progress.percent}%</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            팀 목표 진행
          </p>
        </div>
      </div>

      <div
        className="relative mt-3 h-2 rounded-full bg-paper-deep"
        role="progressbar"
        aria-label="크루 주간 공동 목표"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div
          className="h-full rounded-full bg-track transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
        {progress.milestones.map(milestone => (
          <span
            key={milestone.percent}
            aria-hidden="true"
            className={`absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
              milestone.unlocked
                ? "border-track bg-track text-white"
                : "border-line-strong bg-card text-transparent"
            }`}
            style={{ left: `${milestone.percent}%` }}
          >
            {milestone.unlocked ? <Check size={9} strokeWidth={3} /> : null}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        {progress.milestones.map(milestone => (
          <div key={milestone.percent}>
            <p
              className={`text-[9px] font-extrabold ${milestone.unlocked ? "text-track" : "text-muted-foreground"}`}
            >
              {milestone.percent}%
            </p>
            <p className="mt-0.5 text-[8px] leading-tight text-ink-soft">
              {milestone.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-[3px] bg-track-soft/60 px-3 py-2.5">
        <Gift size={13} className="shrink-0 text-track" />
        <p className="text-[10px] leading-relaxed text-ink-soft">
          {progress.nextMilestone ? (
            <>
              다음 공동 보상 <b>{progress.nextMilestone.label}</b>까지{" "}
              <b className="text-track">{formatKm(progress.remainingM)}km</b>{" "}
              남았어요.
            </>
          ) : (
            <>
              <b className="text-track">크루 완주 달성!</b> 이번 주 목표를 함께
              채웠어요.
            </>
          )}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <span>
          팀 누적 {formatKm(progress.currentM)} / {formatKm(progress.goalM, 0)}
          km
        </span>
        <span>칭호는 이번 주 기록으로 계산돼요</span>
      </div>

      <details className="mt-3 border-t border-line/70 pt-2">
        <summary className="cursor-pointer text-[9px] font-bold text-ink-soft">
          이번 주 러너 배지 조건 보기
        </summary>
        <ul className="mt-2 space-y-1.5">
          {WEEKLY_CREW_BADGES.map(badge => (
            <li
              key={badge.id}
              className="flex items-start gap-1.5 text-[9px] leading-relaxed text-muted-foreground"
            >
              <BadgeCheck size={11} className="mt-0.5 shrink-0 text-track" />
              <span>
                <b className="text-ink-soft">{badge.label}</b> ·{" "}
                {badge.description}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[8px] leading-relaxed text-muted-foreground">
          페이스 메이커 칭호는 1km 이상 러닝 조건을 충족한 기록만 비교해요.
        </p>
      </details>
    </section>
  );
}

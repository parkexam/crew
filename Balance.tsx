import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import { BodyRadar } from "@/components/BodyRadar";
import { Sheet } from "@/components/Sheet";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  ScreenLoader,
  SectionTitle,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import {
  BODY_PART_MAP,
  BODY_PARTS,
  EXERCISES,
  findExercise,
  type BodyPart,
  withParticle,
  type Exercise,
} from "@shared/fitness";

function parseLeadingNumber(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 10;
}

export default function Balance() {
  const utils = trpc.useUtils();
  const overview = trpc.fitness.balance.overview.useQuery(undefined, { staleTime: 15_000 });
  const [filter, setFilter] = useState<BodyPart | "all">("all");
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weightKg, setWeightKg] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const logWorkout = trpc.fitness.balance.logWorkout.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.balance.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
        utils.fitness.goals.overview.invalidate(),
      ]);
      setDetail(null);
      setError(null);
    },
    onError: err => setError(err.message),
  });

  const removeWorkout = trpc.fitness.balance.removeWorkout.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.balance.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
      ]);
    },
  });

  const library = useMemo(
    () =>
      filter === "all" ? EXERCISES : EXERCISES.filter(exercise => exercise.bodyPart === filter),
    [filter],
  );

  if (overview.isLoading) {
    return (
      <AppShell>
        <PageHeader title="밸런스" eyebrow="Body balance" />
        <ScreenLoader label="부위별 기록을 분석하는 중" />
      </AppShell>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <AppShell>
        <PageHeader title="밸런스" eyebrow="Body balance" />
        <ErrorState message={overview.error?.message} onRetry={() => overview.refetch()} />
      </AppShell>
    );
  }

  const { balance, routine, logs, threshold } = overview.data;

  const openExercise = (exercise: Exercise) => {
    setDetail(exercise);
    setSets(exercise.sets);
    setReps(parseLeadingNumber(exercise.reps));
    setWeightKg(0);
    setDurationMin(exercise.reps.includes("초") ? 1 : 0);
    setError(null);
  };

  const quickLog = (exercise: Exercise) => {
    if (done.includes(exercise.slug)) return;
    logWorkout.mutate({
      bodyPart: exercise.bodyPart,
      exerciseSlug: exercise.slug,
      sets: exercise.sets,
      reps: parseLeadingNumber(exercise.reps),
      weightKg: 0,
      durationMin: exercise.reps.includes("초") ? 1 : 0,
    });
    setDone(prev => [...prev, exercise.slug]);
  };

  const estimatedProgress = Math.min(100, Math.round((balance.logCount / threshold) * 100));

  return (
    <AppShell>
      <PageHeader
        title="밸런스"
        eyebrow="Body balance"
        right={
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              document
                .getElementById("exercise-library")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[10px] font-bold text-ink-soft"
          >
            <Plus size={11} /> 운동 기록
          </button>
        }
      />

      <div className="px-5 pb-6 pt-4">
        <section className="card overflow-hidden">
          <div className="flex items-start justify-between px-4 pt-4">
            <div>
              <p className="label">7 part balance</p>
              <p className="mt-1 text-[12px] font-extrabold tracking-[-0.03em]">
                {balance.deficits.length > 0
                  ? `${balance.deficits.map(part => part.label).join(" · ")}가 부족해요`
                  : "전신 균형이 좋아요"}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[9px] font-bold",
                balance.estimated
                  ? "border border-gold/40 bg-gold/10 text-gold"
                  : "border border-sage/40 bg-sage/10 text-sage",
              )}
            >
              {balance.estimated ? "설문 기반 추정" : "실제 기록"}
            </span>
          </div>

          <BodyRadar
            data={balance.parts.map(part => ({ label: part.label, score: part.score }))}
            overall={balance.score}
            estimated={balance.estimated}
          />

          <div className="flex flex-wrap gap-1.5 px-4 pb-4">
            {balance.parts.map(part => (
              <span
                key={part.key}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold",
                  part.isDeficit
                    ? "border-track/40 bg-track-soft text-track"
                    : "border-line text-ink-soft",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: part.color }}
                />
                {part.label} {part.score}
              </span>
            ))}
          </div>
        </section>

        {balance.estimated ? (
          <div className="mt-3 rounded-[3px] border border-gold/30 bg-gold/[0.06] px-3.5 py-3">
            <p className="flex items-center gap-1 text-[10px] font-bold text-ink">
              <Info size={11} className="text-gold" /> 지금은 온보딩 설문으로 추정하고 있어요
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              운동을 {threshold}회 기록하면 실제 볼륨 데이터로 자동 전환됩니다.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep">
                <div className="h-full rounded-full bg-gold" style={{ width: `${estimatedProgress}%` }} />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground">
                {balance.logCount}/{threshold}
              </span>
            </div>
          </div>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-[4px] bg-ink px-5 py-5 text-paper">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-track">Diagnosis</p>
            <span className="display text-[22px] text-paper/80">{balance.score}<span className="ml-0.5 text-[9px] font-sans font-bold text-paper/40">/100</span></span>
          </div>
          <p className="mt-2 text-[15px] font-extrabold leading-snug tracking-[-0.03em]">
            {balance.deficits.length > 0
              ? `${withParticle(balance.deficits.map(part => part.label).join(", "), "을/를")} 먼저 채우세요.`
              : "지금은 모든 부위가 고르게 채워지고 있어요."}
          </p>
          <div className="mt-3 space-y-2">
            {balance.deficits.map(part => (
              <div key={part.key} className="rounded-[3px] border border-paper/12 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: part.color }}
                    />
                    {part.label}
                  </span>
                  <span className="display text-[16px] text-track">{part.score}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-paper/50">
                  {part.daysSince === null
                    ? "최근 2주 기록이 거의 없어요"
                    : part.daysSince >= 6
                      ? `${part.daysSince}일째 운동 기록이 없어요`
                      : `이상적인 볼륨의 ${Math.round((part.share / (1 / 7)) * 100)}% 수준이에요`}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-paper/40">
            최근 2주간 부위별 세트·횟수·무게로 계산한 상대 볼륨과 마지막 운동일을 함께 봅니다.
          </p>
        </section>

        <section className="mt-6">
          <SectionTitle
            title="오늘의 추천 루틴"
            caption={routine.summary}
            right={
              <span className="whitespace-nowrap rounded-full bg-track px-2.5 py-1 text-[9px] font-bold text-white">
                {routine.minutes}분
              </span>
            }
          />
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink">
                <Sparkles size={11} className="text-track" /> {routine.title}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">
                {done.length}/{routine.exercises.length} 완료
              </span>
            </div>
            {routine.exercises.map((exercise, index) => {
              const isDone = done.includes(exercise.slug);
              return (
                <div
                  key={`${exercise.slug}-${index}`}
                  className="flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => quickLog(exercise)}
                    disabled={isDone || logWorkout.isPending}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isDone
                        ? "border-track bg-track text-white"
                        : "border-line-strong text-transparent hover:border-track",
                    )}
                    aria-label={`${exercise.name} 완료`}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openExercise(exercise)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                      {exercise.name}
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                        style={{
                          backgroundColor: `${BODY_PART_MAP[exercise.bodyPart].color}18`,
                          color: BODY_PART_MAP[exercise.bodyPart].color,
                        }}
                      >
                        {BODY_PART_MAP[exercise.bodyPart].label}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {exercise.sets}세트 × {exercise.reps} · {exercise.equipment}
                    </p>
                    {index === 0 ? (
                      <p className="mt-0.5 text-[9px] text-track">{exercise.reason}</p>
                    ) : null}
                  </button>
                  <ChevronRight size={14} className="shrink-0 text-line-strong" />
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
            <Dumbbell size={10} /> 체크하면 바로 운동 기록으로 저장되고 밸런스가 갱신돼요.
          </p>
        </section>

        <section className="mt-6 scroll-mt-16" id="exercise-library">
          <SectionTitle title="운동 라이브러리" caption={`${EXERCISES.length}개 종목 · 부위별로 골라보세요`} />
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-3">
            <button
              type="button"
              onClick={() => setFilter("all")}
              data-active={filter === "all"}
              className="chip shrink-0"
            >
              전체
            </button>
            {BODY_PARTS.map(part => (
              <button
                key={part.key}
                type="button"
                onClick={() => setFilter(part.key)}
                data-active={filter === part.key}
                className="chip shrink-0"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: part.color }}
                />
                {part.label}
              </button>
            ))}
          </div>
          <div className="card divide-y divide-line/70 overflow-hidden">
            {library.map(exercise => (
              <button
                key={exercise.slug}
                type="button"
                onClick={() => openExercise(exercise)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-ink">{exercise.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {exercise.target} · {exercise.sets}세트 × {exercise.reps}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[8px] font-bold text-ink-soft">
                  {exercise.level}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold"
                  style={{
                    backgroundColor: `${BODY_PART_MAP[exercise.bodyPart].color}18`,
                    color: BODY_PART_MAP[exercise.bodyPart].color,
                  }}
                >
                  {BODY_PART_MAP[exercise.bodyPart].label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <SectionTitle title="최근 운동 기록" caption="최근 12개" />
          {logs.length === 0 ? (
            <EmptyState
              title="아직 근력 운동 기록이 없어요"
              description="추천 루틴을 하나 완료하면 밸런스가 실제 데이터로 바뀝니다."
            />
          ) : (
            <div className="card overflow-hidden">
              {logs.map(log => {
                const exercise = findExercise(log.exerciseSlug);
                const isTime = exercise?.reps.includes("초") ?? false;
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-ink">
                        {log.exerciseName}
                        <span
                          className="ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                          style={{
                            backgroundColor: `${
                              BODY_PART_MAP[log.bodyPart as BodyPart]?.color ?? "#888"
                            }18`,
                            color: BODY_PART_MAP[log.bodyPart as BodyPart]?.color ?? "#888",
                          }}
                        >
                          {BODY_PART_MAP[log.bodyPart as BodyPart]?.label ?? log.bodyPart}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {log.dateKey} · {log.sets}세트 × {log.reps}
                        {isTime ? "초" : "회"}
                        {log.weightKg > 0 ? ` · ${log.weightKg}kg` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWorkout.mutate({ id: log.id })}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-paper-deep hover:text-destructive"
                      aria-label="운동 기록 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-[9px] leading-relaxed text-muted-foreground">
          밸런스 점수는 부위별 상대 볼륨과 최근 운동일을 조합한 참고 지표예요.
          <br />
          통증이 있다면 운동을 중단하고 전문가와 상담하세요.
        </p>
      </div>

      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "운동"}
        description={
          detail
            ? `${BODY_PART_MAP[detail.bodyPart].label} · ${detail.target} · ${detail.level}`
            : undefined
        }
      >
        {detail ? (
          <div>
            <div className="rounded-[3px] border border-line bg-paper px-4 py-3.5">
              <p className="text-[11px] font-bold text-ink">자세 팁</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{detail.tip}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                권장 {detail.sets}세트 × {detail.reps} · {detail.equipment}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">세트</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sets}
                  onChange={event => setSets(Number(event.target.value))}
                  className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] font-bold outline-none focus:border-track"
                />
              </label>
              <label className="block">
                <span className="label">{detail.reps.includes("초") ? "초" : "횟수"}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={reps}
                  onChange={event => setReps(Number(event.target.value))}
                  className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] font-bold outline-none focus:border-track"
                />
              </label>
              <label className="block">
                <span className="label">무게 (kg)</span>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={weightKg}
                  onChange={event => setWeightKg(Number(event.target.value))}
                  className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] font-bold outline-none focus:border-track"
                />
              </label>
              <label className="block">
                <span className="label">시간 (분)</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={durationMin}
                  onChange={event => setDurationMin(Number(event.target.value))}
                  className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] font-bold outline-none focus:border-track"
                />
              </label>
            </div>

            <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
              무게는 덤벨·바벨 등 중량 운동일 때만 입력하세요. 맨몸 운동은 0으로 두면 됩니다.
            </p>

            {error ? (
              <p className="mt-3 text-[11px] font-semibold text-destructive">{error}</p>
            ) : null}

            <button
              type="button"
              disabled={logWorkout.isPending}
              onClick={() => {
                setError(null);
                logWorkout.mutate({
                  bodyPart: detail.bodyPart,
                  exerciseSlug: detail.slug,
                  sets,
                  reps,
                  weightKg,
                  durationMin,
                });
              }}
              className="btn-primary mt-4 w-full py-3.5"
            >
              {logWorkout.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
              이 운동 기록하기
            </button>
          </div>
        ) : null}
      </Sheet>
    </AppShell>
  );
}

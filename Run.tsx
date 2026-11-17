import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Check,
  ChevronDown,
  CircleStop,
  Loader2,
  MapPin,
  Pause,
  PencilLine,
  Play,
  RotateCcw,
  Satellite,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionTitle, Stat } from "@/components/primitives";
import { RunRow } from "@/components/RunRow";
import { cn } from "@/lib/utils";
import {
  estimateCalories,
  formatDuration,
  formatKm,
  formatPace,
  percent,
} from "@shared/fitness";

type Phase = "idle" | "running" | "paused" | "finished" | "saved";
type GpsState = "idle" | "requesting" | "active" | "denied" | "unsupported";

const FALLBACK_PACE_SEC = 360;

function haversine(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseDurationInput(value: string): number {
  const parts = value
    .split(":")
    .map(part => Number(part.trim()))
    .filter(part => Number.isFinite(part) && part >= 0);
  if (parts.length === 0) return 0;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

export default function Run() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const dashboard = trpc.fitness.dashboard.useQuery(undefined, { staleTime: 15_000 });
  const runsQuery = trpc.fitness.run.list.useQuery({ limit: 12 });

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [editDistance, setEditDistance] = useState("0.0");
  const [editDuration, setEditDuration] = useState("0:00");
  const [manualEntry, setManualEntry] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<{ distanceM: number; durationSec: number } | null>(
    null,
  );

  const baseElapsedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const logRun = trpc.fitness.run.log.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.dashboard.invalidate(),
        utils.fitness.goals.invalidate(),
        utils.fitness.crew.invalidate(),
        utils.fitness.run.list.invalidate(),
      ]);
      setPhase("saved");
    },
    onError: error => setSaveError(error.message),
  });

  /* 타이머 */
  useEffect(() => {
    if (phase !== "running") return;
    segmentStartRef.current = Date.now();
    const id = window.setInterval(() => {
      const segment = segmentStartRef.current ? (Date.now() - segmentStartRef.current) / 1000 : 0;
      setElapsed(Math.floor(baseElapsedRef.current + segment));
    }, 500);
    return () => {
      if (segmentStartRef.current) {
        baseElapsedRef.current += (Date.now() - segmentStartRef.current) / 1000;
        segmentStartRef.current = null;
      }
      window.clearInterval(id);
    };
  }, [phase]);

  /* GPS가 없을 때 평균 페이스로 거리 추정 */
  useEffect(() => {
    if (phase !== "running") return;
    if (gpsState !== "denied" && gpsState !== "unsupported") return;
    setDistanceM((baseElapsedRef.current + (segmentStartRef.current ? (Date.now() - segmentStartRef.current) / 1000 : 0)) * (1000 / FALLBACK_PACE_SEC));
  }, [elapsed, phase, gpsState]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      wakeLockRef.current?.release().catch(() => undefined);
    };
  }, []);

  const stopGps = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  };

  const startGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsState("unsupported");
      return;
    }
    setGpsState("requesting");
    lastPositionRef.current = null;
    watchRef.current = navigator.geolocation.watchPosition(
      position => {
        setGpsState("active");
        setAccuracy(position.coords.accuracy ?? null);
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        if ((position.coords.accuracy ?? 0) > 50) return;
        const last = lastPositionRef.current;
        if (last) {
          const delta = haversine(last, point);
          if (delta > 2 && delta < 200) setDistanceM(prev => prev + delta);
        }
        lastPositionRef.current = point;
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
    );
  };

  const startRun = async () => {
    setPhase("running");
    setStartedAt(new Date());
    setElapsed(0);
    setDistanceM(0);
    baseElapsedRef.current = 0;
    setNote("");
    setManualEntry(false);
    setSaveError(null);
    setSavedSummary(null);
    startGps();
    try {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (wakeLock) wakeLockRef.current = await wakeLock.request("screen");
    } catch {
      // 화면 유지 잠금은 지원되는 환경에서만 동작한다.
    }
  };

  const pauseRun = () => {
    stopGps();
    setPhase("paused");
  };

  const resumeRun = () => {
    if (gpsState === "active" || gpsState === "requesting") {
      startGps();
    }
    setPhase("running");
  };

  const finishRun = () => {
    if (phase === "running") {
      if (segmentStartRef.current) {
        baseElapsedRef.current += (Date.now() - segmentStartRef.current) / 1000;
        segmentStartRef.current = null;
      }
      setElapsed(Math.floor(baseElapsedRef.current));
    }
    stopGps();
    wakeLockRef.current?.release().catch(() => undefined);
    const finalSeconds = Math.floor(baseElapsedRef.current);
    setEditDistance((distanceM / 1000).toFixed(2));
    setEditDuration(
      `${Math.floor(finalSeconds / 60)}:${String(finalSeconds % 60).padStart(2, "0")}`,
    );
    setPhase("finished");
  };

  const openManual = () => {
    baseElapsedRef.current = 0;
    setElapsed(0);
    setDistanceM(0);
    setStartedAt(new Date());
    setEditDistance("");
    setEditDuration("");
    setNote("");
    setManualEntry(true);
    setPhase("finished");
  };

  const resetAll = () => {
    stopGps();
    baseElapsedRef.current = 0;
    setElapsed(0);
    setDistanceM(0);
    setGpsState("idle");
    setPhase("idle");
    setManualEntry(false);
    setSaveError(null);
  };

  const save = () => {
    const distance = Math.round(Number(editDistance.replace(",", ".")) * 1000);
    const duration = parseDurationInput(editDuration);
    if (!Number.isFinite(distance) || distance < 50) {
      setSaveError("거리를 0.05km 이상 입력해 주세요.");
      return;
    }
    if (duration < 10) {
      setSaveError("시간을 10초 이상 입력해 주세요.");
      return;
    }
    setSaveError(null);
    logRun.mutate({
      distanceM: distance,
      durationSec: duration,
      startedAt: (startedAt ?? new Date()).toISOString(),
      note: note.trim() || undefined,
    });
    setSavedSummary({ distanceM: distance, durationSec: duration });
  };

  const paceSec = distanceM > 0 ? elapsed / (distanceM / 1000) : 0;
  const gpsLabel =
    gpsState === "active"
      ? `GPS 추적 중${accuracy ? ` · ±${Math.round(accuracy)}m` : ""}`
      : gpsState === "requesting"
        ? "GPS 위치를 확인하는 중"
        : gpsState === "denied"
          ? "GPS 없이 기록 중 · 6'00\" 페이스 기준"
          : gpsState === "unsupported"
            ? "이 브라우저는 GPS를 지원하지 않아요"
            : "GPS 준비됨";

  if (phase === "running" || phase === "paused") {
    return (
      <div className="fixed inset-0 z-50 flex justify-center bg-ink">
        <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden text-paper">
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-1/2 w-[1px] -translate-x-1/2 opacity-20",
              phase === "running" && "animate-lane",
            )}
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(243,239,229,.6) 0 18px, transparent 18px 40px)",
            }}
          />
          <header className="relative flex items-center justify-between px-5 pb-2 pt-5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  phase === "running" ? "animate-soft-pulse bg-track" : "bg-gold",
                )}
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/60">
                {phase === "running" ? "Running" : "Paused"}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[9px] font-semibold text-paper/40">
              {gpsState === "active" ? <Satellite size={11} /> : <MapPin size={11} />}
              {gpsLabel}
            </span>
          </header>

          <div className="relative flex flex-1 flex-col items-center justify-center px-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-paper/35">Time</p>
            <p className="display mt-2 text-[64px] leading-none text-paper">
              {formatDuration(elapsed)}
            </p>

            <div className="mt-9 grid w-full grid-cols-2 gap-4">
              <div className="rounded-[4px] border border-paper/12 bg-paper/[0.04] px-4 py-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  Distance
                </p>
                <p className="display mt-1 text-[38px] leading-none text-paper">
                  {formatKm(distanceM, 2)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-paper/40">킬로미터</p>
              </div>
              <div className="rounded-[4px] border border-paper/12 bg-paper/[0.04] px-4 py-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  Pace
                </p>
                <p className="display mt-1 text-[38px] leading-none text-paper">
                  {formatPace(paceSec)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-paper/40">/km</p>
              </div>
            </div>

            <div className="mt-4 flex w-full items-center justify-between rounded-[4px] border border-paper/12 px-4 py-3">
              <span className="text-[10px] font-semibold text-paper/45">소모 칼로리</span>
              <span className="display text-[18px] text-paper">
                {estimateCalories(distanceM)}
                <span className="ml-1 text-[9px] font-sans font-bold text-paper/40">kcal</span>
              </span>
            </div>

            {gpsState === "denied" || gpsState === "unsupported" ? (
              <p className="mt-3 text-center text-[10px] leading-relaxed text-gold/80">
                위치 권한을 쓸 수 없어 평균 페이스로 거리를 계산하고 있어요.
                <br />
                종료 후 실제 거리로 수정할 수 있습니다.
              </p>
            ) : null}
          </div>

          <div className="relative px-5 pb-8 pt-4">
            <div className="flex items-center justify-center gap-3">
              {phase === "running" ? (
                <button
                  type="button"
                  onClick={pauseRun}
                  className="flex h-[62px] w-[62px] items-center justify-center rounded-full border border-paper/25 text-paper"
                  aria-label="일시정지"
                >
                  <Pause size={22} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeRun}
                  className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-track text-white"
                  aria-label="재개"
                >
                  <Play size={22} fill="currentColor" />
                </button>
              )}
              <button
                type="button"
                onClick={finishRun}
                className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-full bg-paper text-[14px] font-extrabold text-ink"
              >
                <CircleStop size={18} /> 러닝 종료
              </button>
            </div>
            <p className="mt-3 text-center text-[9px] text-paper/30">
              종료하면 거리와 시간을 확인하고 저장할 수 있어요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-paper">
        <div className="flex w-full max-w-[480px] flex-col px-5 pb-8 pt-5">
          <div className="flex items-center justify-between">
            <p className="label">{manualEntry ? "Manual entry" : "Run complete"}</p>
            <button
              type="button"
              onClick={resetAll}
              className="text-[10px] font-bold text-muted-foreground"
            >
              취소
            </button>
          </div>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.05em]">
            {manualEntry ? "기록을 직접 적어볼까요." : "수고했어요. 오늘도 채웠습니다."}
          </h1>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {manualEntry
              ? "다른 앱에서 달린 기록도 발맞춤에 모아두세요."
              : "저장 전에 거리와 시간을 확인해 주세요."}
          </p>

          <div className="mt-6 rounded-[4px] border border-line bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="label">거리 (km)</span>
                <input
                  value={editDistance}
                  onChange={event => setEditDistance(event.target.value)}
                  inputMode="decimal"
                  placeholder="5.00"
                  className="mt-1 w-full border-b border-line-strong bg-transparent pb-1.5 text-[26px] font-extrabold tracking-[-0.03em] outline-none focus:border-track"
                />
              </label>
              <label className="block">
                <span className="label">시간 (분:초)</span>
                <input
                  value={editDuration}
                  onChange={event => setEditDuration(event.target.value)}
                  inputMode="numeric"
                  placeholder="30:00"
                  className="mt-1 w-full border-b border-line-strong bg-transparent pb-1.5 text-[26px] font-extrabold tracking-[-0.03em] outline-none focus:border-track"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[11px] text-muted-foreground">평균 페이스</span>
              <span className="display text-[20px]">
                {formatPace(
                  parseDurationInput(editDuration) /
                    Math.max(0.001, Number(editDistance.replace(",", ".")) || 0),
                )}
                <span className="ml-1 text-[9px] font-sans font-bold text-muted-foreground">/km</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">예상 칼로리</span>
              <span className="display text-[20px]">
                {estimateCalories(Math.round((Number(editDistance.replace(",", ".")) || 0) * 1000))}
                <span className="ml-1 text-[9px] font-sans font-bold text-muted-foreground">
                  kcal
                </span>
              </span>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="label">한 줄 메모 · 선택</span>
            <input
              value={note}
              onChange={event => setNote(event.target.value.slice(0, 140))}
              placeholder="오늘 러닝은 어땠나요?"
              className="mt-1 w-full rounded-[3px] border border-line bg-card px-3.5 py-3 text-[12px] outline-none focus:border-track"
            />
          </label>

          {saveError ? (
            <p className="mt-2 text-[11px] font-semibold text-destructive">{saveError}</p>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={logRun.isPending}
            className="btn-primary mt-5 w-full py-4"
          >
            {logRun.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> 저장하는 중
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={3} /> 기록 저장하기
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="mt-2 text-[11px] font-semibold text-muted-foreground"
          >
            저장하지 않고 나가기
          </button>
        </div>
      </div>
    );
  }

  if (phase === "saved" && savedSummary) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-paper">
        <div className="flex w-full max-w-[480px] flex-col items-center px-5 pb-10 pt-16">
          <span className="animate-stamp flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-track text-center text-[10px] font-extrabold uppercase leading-tight tracking-[0.12em] text-track">
            Goal
            <br />
            logged
          </span>
          <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.05em]">기록을 저장했어요</h1>
          <p className="mt-1.5 text-[12px] text-muted-foreground">크루 랭킹에 바로 반영됩니다.</p>

          <div className="mt-7 w-full rounded-[4px] bg-ink px-5 py-6 text-paper">
            <div className="grid grid-cols-3 divide-x divide-paper/12">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  거리
                </p>
                <p className="display mt-1.5 text-[30px]">{formatKm(savedSummary.distanceM)}</p>
                <p className="text-[9px] font-bold text-paper/40">KM</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  시간
                </p>
                <p className="display mt-1.5 text-[30px]">
                  {formatDuration(savedSummary.durationSec)}
                </p>
                <p className="text-[9px] font-bold text-paper/40">TIME</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper/40">
                  페이스
                </p>
                <p className="display mt-1.5 text-[30px]">
                  {formatPace(savedSummary.durationSec / (savedSummary.distanceM / 1000))}
                </p>
                <p className="text-[9px] font-bold text-paper/40">/KM</p>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => navigate("/")} className="btn-primary mt-6 w-full py-4">
            홈으로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => navigate("/crew")}
            className="btn-ghost mt-2 w-full py-3.5"
          >
            크루 랭킹 보기
          </button>
        </div>
      </div>
    );
  }

  const today = dashboard.data?.today;

  return (
    <AppShell>
      <PageHeader title="러닝" eyebrow="Track" />

      <div className="px-5 pb-6 pt-4">
        <div className="relative overflow-hidden rounded-[4px] bg-ink px-5 py-6 text-paper">
          <div className="absolute inset-y-0 right-5 w-[1px] opacity-15">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(243,239,229,.8) 0 12px, transparent 12px 24px)",
              }}
            />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-track">Ready</p>
          <p className="display mt-2 text-[56px] leading-[0.85]">Run</p>
          <p className="mt-3 max-w-[240px] text-[11px] leading-relaxed text-paper/55">
            {today && today.remainingM > 0
              ? `오늘 목표까지 ${formatKm(today.remainingM)}km 남았어요. 시작 버튼을 누르면 거리와 페이스를 기록합니다.`
              : "오늘 목표를 채웠어요. 한 번 더 달려도 좋아요."}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={startRun}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-track text-white shadow-[0_12px_30px_rgba(255,74,28,0.4)] transition-transform active:scale-95"
              aria-label="러닝 시작"
            >
              <Play size={30} fill="currentColor" className="ml-1" />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/35">
                Tap to start
              </p>
              <p className="mt-1 text-[13px] font-bold text-paper/85">GPS 러닝 시작</p>
              <p className="mt-0.5 text-[10px] text-paper/40">
                {today ? `오늘 ${formatKm(today.distanceM)}km / ${formatKm(today.goalM, 0)}km` : ""}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openManual}
          className="mt-3 flex w-full items-center justify-between rounded-[3px] border border-dashed border-line-strong px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-[11px] font-bold text-ink-soft">
            <PencilLine size={13} /> 다른 앱에서 달린 기록 직접 입력
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>

        {today ? (
          <div className="card mt-4 px-4 py-4">
            <div className="flex items-center justify-between">
              <SectionTitle title="오늘의 진행" />
              <span className="display text-[20px]">{today.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full rounded-full bg-track transition-all"
                style={{ width: `${today.pct}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3">
              <Stat label="거리" value={formatKm(today.distanceM)} unit="km" />
              <Stat label="시간" value={formatDuration(today.durationSec)} align="center" />
              <Stat
                label="목표"
                value={`${formatKm(today.goalM, 0)}`}
                unit="km"
                align="right"
              />
            </div>
          </div>
        ) : null}

        <section className="mt-6">
          <SectionTitle title="최근 러닝" caption="최근 12개 기록" />
          <div className="card px-4">
            {runsQuery.data && runsQuery.data.length > 0 ? (
              runsQuery.data.map(run => <RunRow key={run.id} run={run} />)
            ) : (
              <p className="py-6 text-center text-[11px] text-muted-foreground">
                아직 러닝 기록이 없어요. 첫 러닝을 시작해 보세요.
              </p>
            )}
          </div>
        </section>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[9px] text-muted-foreground">
          <RotateCcw size={10} /> 일시정지 후 재개해도 시간과 거리가 이어집니다.
        </p>
      </div>
    </AppShell>
  );
}

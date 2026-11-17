import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { notifySessionChanged, saveSession } from "@/lib/session";
import { BrandMark } from "@/components/AppShell";
import { ProgressRing } from "@/components/ProgressRing";
import { cn } from "@/lib/utils";
import { AVATARS, BODY_PARTS, type BodyPart } from "@shared/fitness";

const DISTANCE_OPTIONS = [3, 5, 7, 10];
const MINUTE_OPTIONS = [20, 30, 45, 60];

export default function Welcome() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [distanceKm, setDistanceKm] = useState(5);
  const [minutes, setMinutes] = useState(30);
  const [primaryPart, setPrimaryPart] = useState<BodyPart | null>(null);
  const [neglected, setNeglected] = useState<BodyPart[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createSession = trpc.fitness.createSession.useMutation({
    onSuccess: async data => {
      saveSession({ handle: data.runner.handle, token: data.token });
      notifySessionChanged();
      await utils.fitness.me.invalidate();
      navigate("/");
    },
    onError: err => setError(err.message),
  });

  const baseline = useMemo(() => {
    const result: Partial<Record<BodyPart, number>> = {};
    for (const part of BODY_PARTS) {
      if (primaryPart === part.key) result[part.key] = 4;
      else if (neglected.includes(part.key)) result[part.key] = 0.5;
      else result[part.key] = 2;
    }
    return result;
  }, [primaryPart, neglected]);

  const toggleNeglected = (part: BodyPart) => {
    if (part === primaryPart) return;
    setNeglected(prev =>
      prev.includes(part) ? prev.filter(item => item !== part) : [...prev, part].slice(0, 3),
    );
  };

  const canContinue = step === 0 ? nickname.trim().length > 0 : true;

  const submit = () => {
    setError(null);
    createSession.mutate({
      nickname: nickname.trim(),
      avatar,
      dailyGoalM: distanceKm * 1000,
      dailyGoalMin: minutes,
      baseline,
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-ink text-paper">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <BrandMark tone="light" />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(index => (
            <span
              key={index}
              className={cn(
                "h-[3px] rounded-full transition-all",
                index === step ? "w-7 bg-track" : "w-3 bg-paper/25",
              )}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 px-5 pb-8 pt-4">
        {step === 0 ? (
          <div className="animate-rise">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-track">
              Step 01 — Runner card
            </p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.12] tracking-[-0.055em]">
              같이 뛰면,
              <br />
              더 멀리 갑니다.
            </h1>
            <p className="mt-3 max-w-[300px] text-[12px] leading-relaxed text-paper/60">
              크루와 기록을 맞대고, 매일의 목표를 채우고, 비어 있는 부위까지 채우는 러닝 앱.
            </p>

            <div className="relative mt-7 -rotate-[1.2deg] overflow-hidden rounded-[4px] bg-paper p-5 text-ink shadow-[0_30px_60px_rgba(0,0,0,0.38)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="label">Bib number</p>
                  <p className="display mt-1 text-[46px] leading-none">001</p>
                </div>
                <div className="text-right">
                  <p className="label">Crew</p>
                  <p className="mt-1 text-[12px] font-extrabold">한강 새벽런</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">CODE · DAWN55</p>
                </div>
              </div>

              <div className="perforated my-4" />

              <label className="label block" htmlFor="nickname">
                이름
              </label>
              <input
                id="nickname"
                value={nickname}
                onChange={event => setNickname(event.target.value.slice(0, 12))}
                placeholder="닉네임을 적어주세요"
                autoComplete="nickname"
                className="mt-1 w-full border-b-2 border-ink/15 bg-transparent pb-1.5 text-[22px] font-extrabold tracking-[-0.04em] outline-none placeholder:font-semibold placeholder:text-ink/25 focus:border-track"
              />
              <p className="mt-1 text-right text-[9px] font-semibold text-muted-foreground">
                {nickname.length}/12
              </p>

              <p className="label mb-2 mt-3">페이스 메이트</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border text-lg transition-all",
                      avatar === emoji
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-card hover:border-ink/40",
                    )}
                    aria-label={`아바타 ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="animate-rise">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-track">
              Step 02 — Daily goal
            </p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.12] tracking-[-0.055em]">
              하루에 얼마나
              <br />
              달릴까요?
            </h1>
            <p className="mt-3 text-[12px] leading-relaxed text-paper/60">
              목표는 언제든 바꿀 수 있어요. 작게 시작해서 매일 채워보세요.
            </p>

            <div className="mt-8 flex items-center justify-center">
              <ProgressRing
                value={72}
                size={196}
                stroke={12}
                color="var(--accent)"
                track="rgba(243,239,229,0.16)"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-paper/50">
                  오늘의 목표
                </span>
                <span className="display mt-1 text-[54px] leading-none text-paper">
                  {distanceKm}
                </span>
                <span className="text-[10px] font-bold text-paper/60">킬로미터</span>
                <span className="mt-2 rounded-full border border-paper/25 px-2 py-0.5 text-[10px] font-semibold text-paper/70">
                  약 {minutes}분
                </span>
              </ProgressRing>
            </div>

            <div className="mt-8">
              <p className="label mb-2 text-paper/50">거리</p>
              <div className="grid grid-cols-4 gap-1.5">
                {DISTANCE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDistanceKm(option)}
                    className={cn(
                      "rounded-[3px] border py-3 text-[15px] font-extrabold transition-colors",
                      distanceKm === option
                        ? "border-track bg-track text-white"
                        : "border-paper/20 text-paper/80 hover:border-paper/40",
                    )}
                  >
                    {option}
                    <span className="ml-0.5 text-[10px] font-bold">km</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="label mb-2 text-paper/50">목표 시간</p>
              <div className="grid grid-cols-4 gap-1.5">
                {MINUTE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMinutes(option)}
                    className={cn(
                      "rounded-[3px] border py-3 text-[15px] font-extrabold transition-colors",
                      minutes === option
                        ? "border-track bg-track text-white"
                        : "border-paper/20 text-paper/80 hover:border-paper/40",
                    )}
                  >
                    {option}
                    <span className="ml-0.5 text-[10px] font-bold">분</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="animate-rise">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-track">
              Step 03 — Body balance
            </p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.12] tracking-[-0.055em]">
              어디가
              <br />
              비어 있나요?
            </h1>
            <p className="mt-3 text-[12px] leading-relaxed text-paper/60">
              최근 2주를 떠올려 주세요. 기록이 쌓이면 실제 운동 데이터로 자동 전환됩니다.
            </p>

            <div className="mt-7">
              <p className="label mb-2 text-paper/50">가장 자주 하는 부위 · 1개</p>
              <div className="flex flex-wrap gap-1.5">
                {BODY_PARTS.map(part => (
                  <button
                    key={part.key}
                    type="button"
                    onClick={() => {
                      setPrimaryPart(prev => (prev === part.key ? null : part.key));
                      setNeglected(prev => prev.filter(item => item !== part.key));
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-[12px] font-bold transition-colors",
                      primaryPart === part.key
                        ? "border-paper bg-paper text-ink"
                        : "border-paper/20 text-paper/75",
                    )}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="label mb-2 text-paper/50">거의 안 하는 부위 · 최대 3개</p>
              <div className="flex flex-wrap gap-1.5">
                {BODY_PARTS.map(part => {
                  const disabled = primaryPart === part.key;
                  const active = neglected.includes(part.key);
                  return (
                    <button
                      key={part.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleNeglected(part.key)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3.5 py-2 text-[12px] font-bold transition-colors",
                        active
                          ? "border-track bg-track text-white"
                          : "border-paper/20 text-paper/75",
                        disabled && "cursor-not-allowed opacity-25",
                      )}
                    >
                      {active ? <Check size={12} strokeWidth={3} /> : null}
                      {part.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 rounded-[3px] border border-paper/15 bg-paper/[0.04] p-4">
              <p className="text-[11px] font-bold text-paper/85">이렇게 분석해요</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-paper/55">
                가슴·등·어깨·팔·코어·하체·둔근 7개 부위의 최근 2주 볼륨을 비교해 부족한 곳을
                찾고, 그 부위를 채우는 오늘의 루틴을 추천합니다.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-paper/12 bg-ink/95 px-5 pb-6 pt-4 backdrop-blur">
        {error ? <p className="mb-2 text-[11px] font-semibold text-track">{error}</p> : null}
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(prev => prev - 1)}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-paper/25 text-paper/80"
              aria-label="이전 단계"
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canContinue || createSession.isPending}
            onClick={() => {
              if (step < 2) {
                setStep(prev => prev + 1);
                return;
              }
              submit();
            }}
            className={cn(
              "flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-extrabold transition-all",
              canContinue
                ? "bg-track text-white shadow-[0_10px_26px_rgba(255,74,28,0.35)]"
                : "cursor-not-allowed bg-paper/15 text-paper/40",
            )}
          >
            {createSession.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> 크루에 입장하는 중
              </>
            ) : step < 2 ? (
              <>
                다음 <ArrowRight size={16} />
              </>
            ) : (
              <>
                크루 입장하기 <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
        <p className="mt-2.5 text-center text-[9px] font-medium text-paper/35">
          이 기기에 기록이 저장됩니다. 앱을 지우면 계정도 사라져요.
        </p>
      </div>
    </div>
  );
}

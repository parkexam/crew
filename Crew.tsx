import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Crown,
  Footprints,
  BadgeCheck,
  Loader2,
  LogOut,
  Plus,
  Radio,
  Trophy,
  UserPlus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import { CrewMission } from "@/components/CrewMission";
import { Sheet } from "@/components/Sheet";
import {
  Avatar,
  EmptyState,
  ErrorState,
  PageHeader,
  ScreenLoader,
  SectionTitle,
  Segmented,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatKm,
  formatPace,
  timeAgo,
} from "@shared/fitness";
import { getWeeklyCrewBadges } from "@shared/crew-rewards";

type Metric = "distance" | "duration" | "pace";
type Tab = "rank" | "feed";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "distance", label: "거리" },
  { value: "duration", label: "시간" },
  { value: "pace", label: "페이스" },
];

function metricValue(
  metric: Metric,
  member: { distanceM: number; durationSec: number; paceSec: number },
): string {
  if (metric === "distance") return formatKm(member.distanceM);
  if (metric === "duration") return formatDuration(member.durationSec);
  return member.paceSec > 0 ? formatPace(member.paceSec) : "—";
}

export default function Crew() {
  const utils = trpc.useUtils();
  const overview = trpc.fitness.crew.overview.useQuery(undefined, { staleTime: 15_000 });
  const [tab, setTab] = useState<Tab>("rank");
  const [metric, setMetric] = useState<Metric>("distance");
  const [sheet, setSheet] = useState<"none" | "create" | "join" | "leave">("none");
  const [crewName, setCrewName] = useState("");
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(100);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCrew = trpc.fitness.crew.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.crew.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
      ]);
      setSheet("none");
      setCrewName("");
    },
    onError: err => setError(err.message),
  });

  const joinCrew = trpc.fitness.crew.join.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.crew.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
      ]);
      setSheet("none");
      setCode("");
    },
    onError: err => setError(err.message),
  });

  const leaveCrew = trpc.fitness.crew.leave.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fitness.crew.overview.invalidate(),
        utils.fitness.dashboard.invalidate(),
      ]);
      setSheet("none");
    },
  });

  const ranked = useMemo(() => {
    const members = overview.data?.week ?? [];
    const sorted = [...members].sort((a, b) => {
      if (metric === "distance") return b.distanceM - a.distanceM;
      if (metric === "duration") return b.durationSec - a.durationSec;
      if (a.paceSec === 0) return 1;
      if (b.paceSec === 0) return -1;
      return a.paceSec - b.paceSec;
    });
    return sorted.map((member, index) => ({ ...member, displayRank: index + 1 }));
  }, [overview.data?.week, metric]);

  if (overview.isLoading) {
    return (
      <AppShell>
        <PageHeader title="크루" eyebrow="Crew" />
        <ScreenLoader label="크루 기록을 모으는 중" />
      </AppShell>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <AppShell>
        <PageHeader title="크루" eyebrow="Crew" />
        <ErrorState message={overview.error?.message} onRetry={() => overview.refetch()} />
      </AppShell>
    );
  }

  const data = overview.data;
  const crew = data.crew;
  const me = ranked.find(member => member.isMe);
  const leader = ranked[0];
  const podium = ranked.slice(0, 3);
  const myPaceRank =
    crew && me
      ? [...(data.week ?? [])]
          .filter(member => member.paceSec > 0)
          .sort((a, b) => a.paceSec - b.paceSec)
          .findIndex(member => member.isMe) + 1
      : 0;
  const badgeAwards = getWeeklyCrewBadges(data.week);

  const copyCode = async () => {
    if (!crew) return;
    try {
      await navigator.clipboard.writeText(crew.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="크루"
        eyebrow="Crew"
        right={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSheet("join");
              }}
              className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[10px] font-bold text-ink-soft"
            >
              <UserPlus size={12} /> 참여
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSheet("create");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper"
              aria-label="크루 만들기"
            >
              <Plus size={15} />
            </button>
          </div>
        }
      />

      <div className="px-5 pb-6 pt-4">
        {!crew ? (
          <EmptyState
            title="아직 크루가 없어요"
            description="초대 코드로 친구 크루에 들어가거나, 새 크루를 만들어 이번 주 순위를 겨뤄보세요."
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSheet("join")}
                  className="btn-primary px-4 py-2.5 text-[11px]"
                >
                  코드로 참여
                </button>
                <button
                  type="button"
                  onClick={() => setSheet("create")}
                  className="btn-ghost px-4 py-2.5 text-[11px]"
                >
                  크루 만들기
                </button>
              </div>
            }
          />
        ) : (
          <>
            <section className="overflow-hidden rounded-[4px] border border-line bg-card">
              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <p className="label">My crew</p>
                  <h2 className="mt-1 flex items-center gap-1.5 text-[22px] font-extrabold tracking-[-0.05em]">
                    {crew.name}
                    {crew.isOwner ? <Crown size={14} className="text-gold" /> : null}
                  </h2>
                  <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    러너 {crew.memberCount}명 · 이번 주 함께 {formatKm(data.weekTotalM)}km
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex shrink-0 flex-col items-end rounded-[3px] border border-dashed border-line-strong px-3 py-2"
                >
                  <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Invite code
                  </span>
                  <span className="display mt-0.5 text-[18px] tracking-[0.12em]">{crew.code}</span>
                  <span className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold text-track">
                    {copied ? (
                      <>
                        <Check size={9} /> 복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={9} /> 복사
                      </>
                    )}
                  </span>
                </button>
              </div>
              <CrewMission totalDistanceM={data.weekTotalM} weeklyGoalM={crew.weeklyGoalM} />
            </section>

            <div className="mt-4 flex items-center justify-between">
              <Segmented
                options={[
                  { value: "rank", label: "랭킹" },
                  { value: "feed", label: "피드" },
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === "rank" ? (
                <Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                  <Radio size={11} className="text-track" /> 최근 30일
                </span>
              )}
            </div>

            {tab === "rank" ? (
              <div className="mt-4">
                {podium.length >= 3 ? (
                  <div className="rounded-[4px] border border-line bg-card px-4 pb-4 pt-5">
                    <div className="flex items-end justify-center gap-2">
                      {[podium[1], podium[0], podium[2]].map((member, index) => {
                        const place = index === 1 ? 1 : index === 0 ? 2 : 3;
                        const height = place === 1 ? "h-[86px]" : place === 2 ? "h-[66px]" : "h-[54px]";
                        return (
                          <div key={member.id} className="flex w-[30%] flex-col items-center">
                            <Avatar
                              emoji={member.avatar}
                              size={place === 1 ? "md" : "sm"}
                              highlight={member.isMe}
                            />
                            <p
                              className={cn(
                                "mt-1.5 max-w-full truncate text-[11px] font-bold",
                                member.isMe && "text-track",
                              )}
                            >
                              {member.nickname}
                            </p>
                            <p className="display mt-0.5 text-[17px]">
                              {metricValue(metric, member)}
                              {metric === "distance" ? (
                                <span className="ml-0.5 text-[8px] font-sans font-bold text-muted-foreground">
                                  km
                                </span>
                              ) : null}
                            </p>
                            <div
                              className={cn(
                                "mt-2 flex w-full items-start justify-center rounded-t-[3px] pt-1.5",
                                height,
                                place === 1
                                  ? "bg-ink text-paper"
                                  : "bg-paper-deep text-ink-soft",
                              )}
                            >
                              <span className="display text-[22px] opacity-80">{place}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="card mt-3 overflow-hidden">
                  {ranked.map(member => (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-b-0",
                        member.isMe && "bg-track-soft/60",
                      )}
                    >
                      <span
                        className={cn(
                          "display w-6 text-[16px]",
                          member.displayRank <= 3 ? "text-track" : "text-line-strong",
                        )}
                      >
                        {member.displayRank}
                      </span>
                      <Avatar emoji={member.avatar} size="sm" highlight={member.isMe} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-ink">
                          {member.nickname}
                          {member.isMe ? (
                            <span className="ml-1 text-[9px] font-bold text-track">ME</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {member.runCount}회 · {formatKm(member.distanceM)}km ·{" "}
                          {formatPace(member.paceSec)}/km
                        </p>
                        {(badgeAwards.get(member.id)?.length ?? 0) > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {badgeAwards.get(member.id)?.map(badge => (
                              <span
                                key={badge.id}
                                title={badge.description}
                                className="inline-flex items-center gap-0.5 rounded-full border border-track/25 bg-track-soft/60 px-1.5 py-0.5 text-[8px] font-bold text-track"
                              >
                                <BadgeCheck size={9} /> {badge.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="display text-[18px] text-ink">
                          {metricValue(metric, member)}
                        </p>
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {metric === "distance" ? "km" : metric === "duration" ? "time" : "/km"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {leader && me && me.displayRank > 1 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-[3px] border border-dashed border-line-strong px-3.5 py-3">
                    <Trophy size={14} className="mt-0.5 shrink-0 text-track" />
                    <p className="text-[10px] leading-relaxed text-ink-soft">
                      이번 주 1위 <b>{leader.nickname}</b>님과{" "}
                      <b>{formatKm(Math.max(0, leader.distanceM - me.distanceM))}km</b> 차이예요.
                      {metric === "pace" && myPaceRank > 0 ? (
                        <> 페이스 순위는 {myPaceRank}위.</>
                      ) : null}{" "}
                      남은 주말에 한 번 더 달리면 뒤집을 수 있어요.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {data.feed.length === 0 ? (
                  <EmptyState
                    title="아직 피드가 비어 있어요"
                    description="크루원이 러닝을 기록하면 이곳에 자동으로 올라옵니다."
                  />
                ) : (
                  data.feed.map(item => (
                    <article
                      key={item.id}
                      className={cn(
                        "rounded-[3px] border border-line bg-card px-4 py-3.5",
                        item.isMe && "border-track/40 bg-track-soft/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar emoji={item.avatar} size="xs" highlight={item.isMe} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-ink">
                            {item.nickname}
                            {item.isMe ? (
                              <span className="ml-1 text-[9px] font-bold text-track">ME</span>
                            ) : null}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {timeAgo(item.startedAt)} · {item.dateKey}
                          </p>
                        </div>
                        <span className="display text-[19px]">
                          {formatKm(item.distanceM)}
                          <span className="ml-0.5 text-[9px] font-sans font-bold text-muted-foreground">
                            km
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 border-t border-line/70 pt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {formatDuration(item.durationSec)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Footprints size={10} /> {formatPace(item.paceSec)}/km
                        </span>
                      </div>
                      {item.note ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                          “{item.note}”
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <p className="text-[9px] text-muted-foreground">
                주간 랭킹은 월요일 00:00에 초기화됩니다.
              </p>
              <button
                type="button"
                onClick={() => setSheet("leave")}
                className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground"
              >
                <LogOut size={10} /> 크루 나가기
              </button>
            </div>
          </>
        )}
      </div>

      <Sheet
        open={sheet === "create"}
        onClose={() => setSheet("none")}
        title="새 크루 만들기"
        description="크루를 만들면 6자리 초대 코드가 발급됩니다."
      >
        <label className="block">
          <span className="label">크루 이름</span>
          <input
            value={crewName}
            onChange={event => setCrewName(event.target.value.slice(0, 30))}
            placeholder="예: 퇴근런 클럽"
            className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3.5 py-3 text-[13px] font-semibold outline-none focus:border-track"
          />
        </label>
        <div className="mt-4">
          <span className="label">주간 크루 목표</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {[50, 100, 150, 200].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setWeeklyGoalKm(option)}
                className={cn(
                  "rounded-[3px] border py-2.5 text-[12px] font-extrabold",
                  weeklyGoalKm === option
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink-soft",
                )}
              >
                {option}km
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="mt-3 text-[11px] font-semibold text-destructive">{error}</p> : null}
        <button
          type="button"
          disabled={createCrew.isPending || crewName.trim().length === 0}
          onClick={() => {
            setError(null);
            createCrew.mutate({ name: crewName.trim(), weeklyGoalKm });
          }}
          className="btn-primary mt-5 w-full py-3.5 disabled:opacity-40"
        >
          {createCrew.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          크루 만들기
        </button>
      </Sheet>

      <Sheet
        open={sheet === "join"}
        onClose={() => setSheet("none")}
        title="초대 코드로 참여"
        description="크루원에게 받은 6자리 코드를 입력해 주세요."
      >
        <label className="block">
          <span className="label">초대 코드</span>
          <input
            value={code}
            onChange={event => setCode(event.target.value.toUpperCase().slice(0, 8))}
            placeholder="DAWN55"
            autoCapitalize="characters"
            className="mt-1 w-full rounded-[3px] border border-line bg-paper px-3.5 py-3 text-center text-[22px] font-extrabold tracking-[0.3em] outline-none focus:border-track"
          />
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          체험용 크루 코드는 <b>DAWN55</b>예요. 한강 새벽런 크루에서 바로 순위를 볼 수 있습니다.
        </p>
        {error ? <p className="mt-3 text-[11px] font-semibold text-destructive">{error}</p> : null}
        <button
          type="button"
          disabled={joinCrew.isPending || code.trim().length < 4}
          onClick={() => {
            setError(null);
            joinCrew.mutate({ code: code.trim() });
          }}
          className="btn-primary mt-5 w-full py-3.5 disabled:opacity-40"
        >
          {joinCrew.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          크루 참여하기
        </button>
      </Sheet>

      <Sheet
        open={sheet === "leave"}
        onClose={() => setSheet("none")}
        title="크루에서 나갈까요?"
        description="기록은 그대로 남고, 다른 크루에 참여할 수 있게 됩니다."
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setSheet("none")} className="btn-ghost flex-1 py-3">
            취소
          </button>
          <button
            type="button"
            onClick={() => leaveCrew.mutate()}
            className="flex-1 rounded-full bg-destructive px-4 py-3 text-[12px] font-bold text-white"
          >
            {leaveCrew.isPending ? "나가는 중" : "나가기"}
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}

/**
 * 발맞춤의 공용 도메인 로직.
 * 클라이언트와 서버가 같은 부위 정의, 운동 라이브러리, 밸런스 계산식을 공유한다.
 */

export const BODY_PARTS = [
  { key: "chest", label: "가슴", color: "#FF4A1C" },
  { key: "back", label: "등", color: "#2F6B5E" },
  { key: "shoulders", label: "어깨", color: "#C9A227" },
  { key: "arms", label: "팔", color: "#A2622F" },
  { key: "core", label: "코어", color: "#4C5B9E" },
  { key: "legs", label: "하체", color: "#7C8B6B" },
  { key: "glutes", label: "둔근", color: "#B5537A" },
] as const;

export type BodyPart = (typeof BODY_PARTS)[number]["key"];

export const BODY_PART_MAP: Record<BodyPart, { label: string; color: string }> =
  BODY_PARTS.reduce(
    (acc, part) => {
      acc[part.key] = { label: part.label, color: part.color };
      return acc;
    },
    {} as Record<BodyPart, { label: string; color: string }>,
  );

export function isBodyPart(value: string): value is BodyPart {
  return BODY_PARTS.some(part => part.key === value);
}

export type ExerciseLevel = "입문" | "중급" | "고급";

export type Exercise = {
  slug: string;
  name: string;
  bodyPart: BodyPart;
  equipment: string;
  level: ExerciseLevel;
  sets: number;
  reps: string;
  target: string;
  tip: string;
};

export const EXERCISES: Exercise[] = [
  {
    slug: "pushup",
    name: "푸시업",
    bodyPart: "chest",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "12~15회",
    target: "대흉근 · 삼두",
    tip: "손목은 어깨 바로 아래에 두고, 몸통이 바닥에 닿기 직전까지 천천히 내려갑니다.",
  },
  {
    slug: "incline-pushup",
    name: "인클라인 푸시업",
    bodyPart: "chest",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "12회",
    target: "상부 가슴",
    tip: "벤치나 계단에 손을 걸치면 부담이 줄어 어깨가 편안합니다.",
  },
  {
    slug: "dumbbell-bench",
    name: "덤벨 벤치프레스",
    bodyPart: "chest",
    equipment: "덤벨",
    level: "중급",
    sets: 4,
    reps: "10회",
    target: "대흉근",
    tip: "날개뼈를 모아 고정하고, 내려가는 구간을 3초로 늘려보세요.",
  },
  {
    slug: "cable-fly",
    name: "케이블 플라이",
    bodyPart: "chest",
    equipment: "케이블",
    level: "중급",
    sets: 3,
    reps: "15회",
    target: "가슴 안쪽",
    tip: "팔꿈치는 살짝 굽힌 채, 가슴 앞에서 양손을 모은다는 느낌으로.",
  },
  {
    slug: "pullup",
    name: "풀업",
    bodyPart: "back",
    equipment: "맨몸",
    level: "고급",
    sets: 4,
    reps: "5~8회",
    target: "광배근",
    tip: "턱이 아니라 가슴을 바에 먼저 붙인다는 생각으로 당깁니다.",
  },
  {
    slug: "band-row",
    name: "밴드 로우",
    bodyPart: "back",
    equipment: "밴드",
    level: "입문",
    sets: 3,
    reps: "15회",
    target: "중부 승모 · 광배",
    tip: "팔꿈치를 몸통 뒤로 보내며 날개뼈를 가운데로 모읍니다.",
  },
  {
    slug: "dumbbell-row",
    name: "덤벨 로우",
    bodyPart: "back",
    equipment: "덤벨",
    level: "중급",
    sets: 3,
    reps: "12회",
    target: "광배근",
    tip: "허리가 말리지 않게 척추를 중립으로 유지하고 옆구리를 조입니다.",
  },
  {
    slug: "lat-pulldown",
    name: "랫풀다운",
    bodyPart: "back",
    equipment: "머신",
    level: "입문",
    sets: 3,
    reps: "12회",
    target: "광배근",
    tip: "어깨가 으쓱 올라가지 않게, 팔이 아니라 등으로 당깁니다.",
  },
  {
    slug: "shoulder-press",
    name: "덤벨 숄더 프레스",
    bodyPart: "shoulders",
    equipment: "덤벨",
    level: "중급",
    sets: 3,
    reps: "10회",
    target: "전면 삼각근",
    tip: "허리를 젖히지 말고 코어로 버티며 머리 위로 밀어 올립니다.",
  },
  {
    slug: "lateral-raise",
    name: "사이드 레터럴 레이즈",
    bodyPart: "shoulders",
    equipment: "덤벨",
    level: "입문",
    sets: 3,
    reps: "15회",
    target: "측면 삼각근",
    tip: "가벼운 무게로, 새끼손가락이 살짝 위를 향하게 들어 올립니다.",
  },
  {
    slug: "pike-pushup",
    name: "파이크 푸시업",
    bodyPart: "shoulders",
    equipment: "맨몸",
    level: "중급",
    sets: 3,
    reps: "10회",
    target: "삼각근",
    tip: "엉덩이를 높이 들고 정수리로 바닥을 미는 느낌으로 내려갑니다.",
  },
  {
    slug: "reverse-fly",
    name: "벤트오버 리버스 플라이",
    bodyPart: "shoulders",
    equipment: "덤벨",
    level: "입문",
    sets: 3,
    reps: "15회",
    target: "후면 삼각근",
    tip: "상체를 숙이고 팔을 옆으로 펼쳐 날개뼈 사이를 조입니다.",
  },
  {
    slug: "biceps-curl",
    name: "덤벨 바이셉 컬",
    bodyPart: "arms",
    equipment: "덤벨",
    level: "입문",
    sets: 3,
    reps: "12회",
    target: "이두",
    tip: "팔꿈치를 옆구리에 고정하고 내려갈 때 천천히 버팁니다.",
  },
  {
    slug: "triceps-dips",
    name: "트라이셉 딥스",
    bodyPart: "arms",
    equipment: "맨몸",
    level: "중급",
    sets: 3,
    reps: "10회",
    target: "삼두",
    tip: "어깨가 아프면 발을 가까이 당겨 부담을 줄이세요.",
  },
  {
    slug: "hammer-curl",
    name: "해머 컬",
    bodyPart: "arms",
    equipment: "덤벨",
    level: "입문",
    sets: 3,
    reps: "12회",
    target: "상완 · 전완",
    tip: "손바닥이 서로 마주 보게 유지한 채 들어 올립니다.",
  },
  {
    slug: "plank",
    name: "플랭크",
    bodyPart: "core",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "40초",
    target: "코어 전체",
    tip: "엉덩이가 떨어지지 않게, 갈비뼈를 닫고 복압을 유지합니다.",
  },
  {
    slug: "deadbug",
    name: "데드버그",
    bodyPart: "core",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "10회",
    target: "심부 코어",
    tip: "허리가 바닥에서 뜨지 않을 만큼만 팔다리를 뻗습니다.",
  },
  {
    slug: "hanging-leg-raise",
    name: "행잉 레그 레이즈",
    bodyPart: "core",
    equipment: "맨몸",
    level: "고급",
    sets: 3,
    reps: "8회",
    target: "하복부",
    tip: "반동 없이 골반을 말아 올린다는 느낌으로 천천히.",
  },
  {
    slug: "side-plank",
    name: "사이드 플랭크",
    bodyPart: "core",
    equipment: "맨몸",
    level: "중급",
    sets: 3,
    reps: "30초",
    target: "옆구리",
    tip: "어깨와 발목이 한 줄이 되도록 골반을 들어 올립니다.",
  },
  {
    slug: "bird-dog",
    name: "버드독",
    bodyPart: "core",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "10회",
    target: "코어 · 둔근",
    tip: "반대쪽 팔과 다리를 뻗을 때 골반이 흔들리지 않게.",
  },
  {
    slug: "hollow-hold",
    name: "할로우 홀드",
    bodyPart: "core",
    equipment: "맨몸",
    level: "중급",
    sets: 3,
    reps: "25초",
    target: "복직근",
    tip: "허리가 바닥에서 뜨면 무릎을 굽혀 난이도를 낮춥니다.",
  },
  {
    slug: "squat",
    name: "스쿼트",
    bodyPart: "legs",
    equipment: "맨몸",
    level: "입문",
    sets: 4,
    reps: "15회",
    target: "대퇴사두",
    tip: "무릎은 발끝 방향으로, 엉덩이부터 뒤로 보내며 앉습니다.",
  },
  {
    slug: "lunge",
    name: "런지",
    bodyPart: "legs",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "12회",
    target: "대퇴 · 둔근",
    tip: "앞무릎이 발목을 넘지 않게, 상체는 세워 유지합니다.",
  },
  {
    slug: "step-up",
    name: "스텝업",
    bodyPart: "legs",
    equipment: "박스",
    level: "중급",
    sets: 3,
    reps: "12회",
    target: "대퇴 · 둔근",
    tip: "뒤발로 차지 말고 앞발 뒤꿈치로 바닥을 밀어 올라갑니다.",
  },
  {
    slug: "leg-press",
    name: "레그 프레스",
    bodyPart: "legs",
    equipment: "머신",
    level: "중급",
    sets: 3,
    reps: "12회",
    target: "대퇴사두",
    tip: "무릎을 완전히 잠그지 말고, 허리가 패드에서 뜨지 않게.",
  },
  {
    slug: "calf-raise",
    name: "카프 레이즈",
    bodyPart: "legs",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "20회",
    target: "종아리",
    tip: "정점에서 1초 멈추고 뒤꿈치를 천천히 내립니다.",
  },
  {
    slug: "hip-thrust",
    name: "힙 쓰러스트",
    bodyPart: "glutes",
    equipment: "바벨",
    level: "중급",
    sets: 4,
    reps: "12회",
    target: "둔근",
    tip: "정점에서 1초 멈추고, 허리가 아니라 엉덩이로 밀어 올립니다.",
  },
  {
    slug: "glute-bridge",
    name: "글루트 브리지",
    bodyPart: "glutes",
    equipment: "맨몸",
    level: "입문",
    sets: 3,
    reps: "15회",
    target: "둔근",
    tip: "발뒤꿈치로 바닥을 밀며 골반을 들어 올립니다.",
  },
  {
    slug: "bulgarian-split-squat",
    name: "불가리안 스플릿 스쿼트",
    bodyPart: "glutes",
    equipment: "덤벨",
    level: "고급",
    sets: 3,
    reps: "10회",
    target: "둔근 · 대퇴",
    tip: "뒤발은 균형만 잡고, 앞다리에 체중을 실어 내려갑니다.",
  },
  {
    slug: "kettlebell-swing",
    name: "케틀벨 스윙",
    bodyPart: "glutes",
    equipment: "케틀벨",
    level: "중급",
    sets: 4,
    reps: "15회",
    target: "둔근 · 후면사슬",
    tip: "팔로 들지 말고 골반을 앞으로 튕기는 힘으로 만듭니다.",
  },
];

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES.find(exercise => exercise.slug === slug);
}

export const AVATARS = ["🐰", "🦊", "🐯", "🐻", "🐧", "🐨", "🦌", "🐺"];

export const DEMO_CREW_CODE = "DAWN55";

/* ------------------------------------------------------------------ */
/* 날짜 유틸 (Asia/Seoul 기준)                                          */
/* ------------------------------------------------------------------ */

const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date → Asia/Seoul 기준 YYYY-MM-DD */
export function dateKeyOf(date: Date): string {
  return SEOUL_DATE_FORMATTER.format(date);
}

/** YYYY-MM-DD 에 일수를 더한 키 */
export function addDays(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** 해당 날짜가 속한 주의 월요일 키 */
export function weekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

export function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabel(dateKey: string): string {
  return WEEKDAY_LABELS[dayOfWeek(dateKey)];
}

/** 연속 기록 계산: 오늘(또는 어제)부터 거꾸로 이어진 활동일 수 */
export function calculateStreak(activeDateKeys: string[], todayKey: string): {
  current: number;
  best: number;
} {
  const active = [...new Set(activeDateKeys)].sort();
  if (active.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < active.length; i += 1) {
    if (addDays(active[i - 1], 1) === active[i]) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const activeSet = new Set(active);
  let cursor = activeSet.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let current = 0;
  while (activeSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, best: Math.max(best, current) };
}

/* ------------------------------------------------------------------ */
/* 표시 포맷                                                            */
/* ------------------------------------------------------------------ */

export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const rounded = Math.round(secPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatKm(distanceM: number, digits = 1): string {
  return (Math.max(0, distanceM) / 1000).toFixed(digits);
}

export function formatMinutes(totalSeconds: number): string {
  return `${Math.round(totalSeconds / 60)}분`;
}

export function estimateCalories(distanceM: number, weightKg = 65): number {
  return Math.round((distanceM / 1000) * weightKg * 1.036);
}

export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  return `${weeks}주 전`;
}

export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/** 받침 유무에 맞춰 한국어 조사를 붙인다. 예: 둔근 + 이/가 → 둔근이 */
export function withParticle(
  label: string,
  particle: "이/가" | "을/를" | "은/는" | "과/와",
): string {
  const trimmed = label.trim();
  const last = trimmed.slice(-1);
  const code = last.charCodeAt(0);
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  const [withBatchim, withoutBatchim] = particle.split("/");
  return `${trimmed}${hasBatchim ? withBatchim : withoutBatchim}`;
}

/* ------------------------------------------------------------------ */
/* 부위 밸런스                                                          */
/* ------------------------------------------------------------------ */

export type BalanceLogInput = {
  bodyPart: string;
  sets: number;
  reps: number;
  weightKg: number;
  durationMin: number;
  dateKey: string;
};

export type BalancePart = {
  key: BodyPart;
  label: string;
  color: string;
  score: number;
  share: number;
  points: number;
  daysSince: number | null;
  isDeficit: boolean;
};

export type BalanceResult = {
  parts: BalancePart[];
  score: number;
  estimated: boolean;
  logCount: number;
  deficits: BalancePart[];
};

const IDEAL_SHARE = 1 / BODY_PARTS.length;
const ESTIMATED_SESSION_POINTS = 420;
const LOG_THRESHOLD = 4;

function pointsForLog(log: BalanceLogInput): number {
  const weightFactor = 1 + Math.min(Math.max(log.weightKg, 0), 80) / 60;
  const repPoints = Math.max(log.sets, 1) * Math.max(log.reps, 1) * weightFactor;
  return repPoints + Math.max(log.durationMin, 0) * 3;
}

export function computeBalance(
  logs: BalanceLogInput[],
  baseline: Partial<Record<BodyPart, number>> | null,
  todayKey: string,
): BalanceResult {
  const recentCutoff = addDays(todayKey, -13);
  const recentLogs = logs.filter(log => log.dateKey >= recentCutoff && log.dateKey <= todayKey);
  const useBaseline = recentLogs.length < LOG_THRESHOLD && Boolean(baseline);

  const points: Record<BodyPart, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    arms: 0,
    core: 0,
    legs: 0,
    glutes: 0,
  };
  const lastSeen: Partial<Record<BodyPart, string>> = {};

  if (useBaseline && baseline) {
    for (const part of BODY_PARTS) {
      const sessions = baseline[part.key] ?? 0;
      points[part.key] = sessions * ESTIMATED_SESSION_POINTS;
    }
  } else {
    for (const log of recentLogs) {
      if (!isBodyPart(log.bodyPart)) continue;
      points[log.bodyPart] += pointsForLog(log);
      if (!lastSeen[log.bodyPart] || log.dateKey > lastSeen[log.bodyPart]!) {
        lastSeen[log.bodyPart] = log.dateKey;
      }
    }
  }

  const total = Object.values(points).reduce((sum, value) => sum + value, 0);
  const rawShares = BODY_PARTS.map(part => (total > 0 ? points[part.key] / total : 0));

  const parts: BalancePart[] = BODY_PARTS.map((part, index) => {
    const share = rawShares[index];
    const daysSince = lastSeen[part.key]
      ? Math.max(
          0,
          Math.round(
            (new Date(`${todayKey}T12:00:00Z`).getTime() -
              new Date(`${lastSeen[part.key]}T12:00:00Z`).getTime()) /
              86400000,
          ),
        )
      : useBaseline && (baseline?.[part.key] ?? 0) > 0
        ? 2
        : null;

    const volumeScore = Math.min(100, (share / IDEAL_SHARE) * 80);
    const recencyScore =
      daysSince === null ? 0 : Math.max(0, Math.min(100, 100 - daysSince * 12));
    const score = total === 0 ? 0 : Math.round(volumeScore * 0.75 + recencyScore * 0.25);

    return {
      key: part.key,
      label: part.label,
      color: part.color,
      score,
      share,
      points: Math.round(points[part.key]),
      daysSince,
      isDeficit: false,
    };
  });

  const deviation = parts.reduce((sum, part) => sum + Math.abs(part.share - IDEAL_SHARE), 0);
  const score =
    total === 0
      ? 0
      : Math.round(Math.max(0, Math.min(100, 100 - (deviation / (2 * (1 - IDEAL_SHARE))) * 100)));

  const deficits = [...parts]
    .sort((a, b) => a.score - b.score)
    .filter((part, index) => part.score < 62 || index < 2)
    .slice(0, 3)
    .map(part => ({ ...part, isDeficit: true }));

  const deficitKeys = new Set(deficits.map(part => part.key));

  return {
    parts: parts.map(part => ({ ...part, isDeficit: deficitKeys.has(part.key) })),
    score,
    estimated: useBaseline,
    logCount: recentLogs.length,
    deficits,
  };
}

export type RoutineItem = Exercise & { reason: string };

export type Routine = {
  title: string;
  focus: BodyPart[];
  focusLabels: string[];
  exercises: RoutineItem[];
  minutes: number;
  summary: string;
};

function reasonFor(part: BalancePart): string {
  if (part.daysSince === null) return "최근 2주 기록이 거의 없어요";
  if (part.daysSince >= 6) return `${part.daysSince}일째 기록이 없어요`;
  return `볼륨이 이상적인 비율의 ${Math.round((part.share / IDEAL_SHARE) * 100)}% 수준이에요`;
}

export function buildRoutine(balance: BalanceResult): Routine {
  const focusParts = (balance.deficits.length > 0 ? balance.deficits : balance.parts.slice(0, 2))
    .slice(0, 3)
    .map(part => part.key);

  const quotas = focusParts.length >= 3 ? [2, 2, 1] : focusParts.length === 2 ? [3, 2] : [4];
  const exercises: RoutineItem[] = [];

  focusParts.forEach((part, index) => {
    const quota = quotas[index] ?? 1;
    const candidates = EXERCISES.filter(exercise => exercise.bodyPart === part).sort(
      (a, b) =>
        ["입문", "중급", "고급"].indexOf(a.level) - ["입문", "중급", "고급"].indexOf(b.level),
    );
    const deficit = balance.parts.find(item => item.key === part);
    for (let i = 0; i < quota && i < candidates.length; i += 1) {
      exercises.push({
        ...candidates[i],
        reason: deficit ? reasonFor(deficit) : "",
      });
    }
  });

  const focusLabels = focusParts.map(part => BODY_PART_MAP[part].label);
  const minutes = Math.max(
    15,
    Math.round(exercises.reduce((sum, exercise) => sum + exercise.sets * 1.6, 0)) + 6,
  );

  return {
    title:
      focusLabels.length > 0
        ? `${focusLabels.join("·")} 채우는 ${minutes}분 루틴`
        : "전신 균형 루틴",
    focus: focusParts,
    focusLabels,
    exercises,
    minutes,
    summary:
      focusLabels.length > 0
        ? `이번 주 가장 비어 있는 ${withParticle(focusLabels.join(", "), "을/를")} 먼저 채웁니다. 세트 사이 45초 휴식.`
        : "부위별 볼륨이 고르게 유지되고 있어요. 가벼운 전신 루틴으로 컨디션을 유지하세요.",
  };
}

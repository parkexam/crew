import { formatDuration, formatKm, formatPace, weekdayLabel } from "@shared/fitness";
import { cn } from "@/lib/utils";

export type RunRowData = {
  id: number;
  distanceM: number;
  durationSec: number;
  paceSec: number;
  dateKey: string;
  note?: string | null;
};

export function RunRow({
  run,
  onClick,
  className,
}: {
  run: RunRowData;
  onClick?: () => void;
  className?: string;
}) {
  const [, month, day] = run.dateKey.split("-");
  const dateLabel = `${Number(month)}.${Number(day)} (${weekdayLabel(run.dateKey)})`;

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-line/80 py-3 last:border-b-0",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex w-[52px] shrink-0 flex-col gap-0.5">
        <span className="text-[11px] font-bold text-ink-soft">{dateLabel}</span>
        <span className="text-[10px] text-muted-foreground">러닝</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="display text-[22px] text-ink">{formatKm(run.distanceM)}</span>
          <span className="text-[10px] font-bold text-muted-foreground">KM</span>
          <span className="ml-1.5 text-[11px] font-semibold text-ink-soft">
            {formatDuration(run.durationSec)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {formatPace(run.paceSec)}/km
          </span>
        </div>
        {run.note ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{run.note}</p>
        ) : null}
      </div>
    </div>
  );
}

import { dayOfWeek, WEEKDAY_LABELS } from "@shared/fitness";
import { cn } from "@/lib/utils";

export type CalendarDay = {
  dateKey: string;
  distanceM: number;
  hasWorkout: boolean;
};

function cellColor(day: CalendarDay | null): string {
  if (!day) return "transparent";
  if (day.distanceM >= 10000) return "var(--accent)";
  if (day.distanceM >= 6000) return "color-mix(in srgb, var(--accent) 72%, var(--paper))";
  if (day.distanceM >= 3000) return "color-mix(in srgb, var(--accent) 46%, var(--paper))";
  if (day.distanceM > 0) return "color-mix(in srgb, var(--accent) 24%, var(--paper))";
  if (day.hasWorkout) return "color-mix(in srgb, var(--sage) 40%, var(--paper))";
  return "var(--paper-deep)";
}

export function ActivityCalendar({ days }: { days: CalendarDay[] }) {
  if (days.length === 0) return null;

  const leading = dayOfWeek(days[0].dateKey);
  const padded: (CalendarDay | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...days,
  ];
  while (padded.length % 7 !== 0) padded.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let index = 0; index < padded.length; index += 7) {
    weeks.push(padded.slice(index, index + 7));
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-[3px] pt-[14px]">
        {WEEKDAY_LABELS.map((label, row) => (
          <div
            key={label}
            className="flex h-[15px] items-center text-[8px] font-semibold leading-none text-muted-foreground"
          >
            {row % 2 === 1 ? label : ""}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {weeks.map((week, weekIndex) => {
          const first = week.find(Boolean);
          const previous = weeks[weekIndex - 1]?.find(Boolean);
          const showMonth =
            Boolean(first) &&
            (!previous || previous!.dateKey.slice(5, 7) !== first!.dateKey.slice(5, 7));
          return (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              <div className="h-[11px] text-[8px] font-semibold leading-none text-muted-foreground">
                {showMonth ? `${Number(first!.dateKey.slice(5, 7))}월` : ""}
              </div>
              {week.map((day, row) => (
                <div
                  key={`${weekIndex}-${row}`}
                  title={
                    day
                      ? `${day.dateKey} · ${(day.distanceM / 1000).toFixed(1)}km${
                          day.hasWorkout ? " · 근력" : ""
                        }`
                      : undefined
                  }
                  className={cn(
                    "h-[15px] w-[15px] rounded-[2px]",
                    day && day.distanceM === 0 && !day.hasWorkout && "border border-line/70",
                  )}
                  style={{ backgroundColor: cellColor(day) }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

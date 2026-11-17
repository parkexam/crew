import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

export type RadarDatum = {
  label: string;
  score: number;
};

export function BodyRadar({
  data,
  overall,
  estimated,
}: {
  data: RadarDatum[];
  overall: number;
  estimated?: boolean;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={278}>
        <RadarChart data={data} outerRadius="74%" margin={{ top: 12, right: 26, bottom: 8, left: 26 }}>
          <PolarGrid stroke="var(--line)" strokeDasharray="2 3" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "var(--ink-soft)", fontSize: 11, fontWeight: 700 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="var(--accent)"
            fillOpacity={0.18}
            dot={{ r: 2.5, fill: "var(--accent)", strokeWidth: 0 }}
            isAnimationActive
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="label">밸런스</span>
        <span className="display text-[34px] text-ink">{overall}</span>
        <span className="text-[9px] font-semibold text-muted-foreground">
          {estimated ? "설문 기반 추정" : "최근 2주"}
        </span>
      </div>
    </div>
  );
}

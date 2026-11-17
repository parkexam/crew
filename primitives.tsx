import type { ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Avatar({
  emoji,
  size = "md",
  highlight = false,
  className,
}: {
  emoji: string;
  size?: "xs" | "sm" | "md" | "lg";
  highlight?: boolean;
  className?: string;
}) {
  const sizes: Record<string, string> = {
    xs: "h-7 w-7 text-sm",
    sm: "h-9 w-9 text-base",
    md: "h-11 w-11 text-xl",
    lg: "h-16 w-16 text-3xl",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border bg-paper-deep",
        highlight ? "border-track ring-2 ring-track/15" : "border-line",
        sizes[size],
        className,
      )}
    >
      {emoji}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  align = "left",
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  align?: "left" | "center" | "right";
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
      )}
    >
      <span className="label">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "display text-[26px] leading-none",
            accent ? "text-track" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[11px] font-semibold text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  right,
  onBack,
  sticky = true,
}: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  onBack?: () => void;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/92 px-5 py-3.5 backdrop-blur-md",
        sticky && "sticky top-0",
      )}
    >
      <div className="flex items-center gap-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep"
            aria-label="뒤로"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div>
          {eyebrow ? <p className="label mb-0.5">{eyebrow}</p> : null}
          <h1 className="text-[17px] font-extrabold tracking-[-0.04em] text-ink">{title}</h1>
        </div>
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({
  title,
  caption,
  right,
}: {
  title: string;
  caption?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
        {caption ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-paper-deep/60 p-1",
        className,
      )}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
              active ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ScreenLoader({ label = "기록을 불러오는 중" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-track" />
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

export function ErrorState({
  message = "잠시 후 다시 시도해 주세요.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-5 my-8 rounded-[3px] border border-line bg-card p-6 text-center">
      <p className="text-sm font-bold text-ink">기록을 불러오지 못했어요</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-ghost mt-4">
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[3px] border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stamp({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex h-14 w-14 -rotate-6 items-center justify-center rounded-full border-2 border-dashed text-[9px] font-extrabold uppercase tracking-[0.12em]",
        tone === "accent"
          ? "border-track/70 text-track"
          : "border-ink/40 text-ink/70",
      )}
    >
      {children}
    </span>
  );
}

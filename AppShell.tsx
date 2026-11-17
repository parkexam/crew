import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Activity, House, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex items-end gap-[3px]" aria-hidden>
        <i className="block h-[13px] w-[3px] skew-x-[-18deg] bg-track" />
        <i
          className={cn("block h-[17px] w-[3px] skew-x-[-18deg]", isLight ? "bg-paper" : "bg-ink")}
        />
        <i
          className={cn(
            "block h-[9px] w-[3px] skew-x-[-18deg]",
            isLight ? "bg-paper/40" : "bg-line-strong",
          )}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[17px] font-extrabold tracking-[-0.07em]",
            isLight ? "text-paper" : "text-ink",
          )}
        >
          발맞춤
        </span>
        <span
          className={cn(
            "mt-[3px] text-[7px] font-bold uppercase tracking-[0.26em]",
            isLight ? "text-paper/45" : "text-muted-foreground",
          )}
        >
          Run crew
        </span>
      </span>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: House },
  { href: "/goals", label: "목표", icon: Target },
  { href: "/run", label: "러닝", icon: null },
  { href: "/crew", label: "크루", icon: Users },
  { href: "/balance", label: "밸런스", icon: Activity },
] as const;

export function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav className="tabbar fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 safe-bottom">
      <div className="grid h-[62px] grid-cols-5 items-center px-1">
        {NAV_ITEMS.map(item => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          if (!item.icon) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className="relative flex flex-col items-center justify-center"
                aria-label="러닝 시작"
              >
                <span className="absolute -top-[19px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-track text-white shadow-[0_10px_24px_rgba(255,74,28,0.34)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M13.5 4.2a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z"
                      fill="currentColor"
                    />
                    <path
                      d="M11.4 7.1 8.6 10l2.2 2.1-1.9 4.3m3.6-9.3 2.4 2.5 2.4.9m-6.5-2.6 2.4 1.3 1.7 3.5-2.2 2.6-1.1 3.4"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  className={cn(
                    "mt-[38px] text-[10px] font-bold",
                    active ? "text-track" : "text-ink-soft",
                  )}
                >
                  러닝
                </span>
              </button>
            );
          }
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className="relative flex h-full flex-col items-center justify-center gap-1"
            >
              <span
                className={cn(
                  "absolute top-0 h-[2px] w-6 rounded-full transition-opacity",
                  active ? "bg-track opacity-100" : "opacity-0",
                )}
              />
              <Icon
                size={19}
                strokeWidth={active ? 2.4 : 1.9}
                className={active ? "text-ink" : "text-muted-foreground"}
              />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  active ? "text-ink" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <main className="flex-1 pb-[78px]">{children}</main>
      <BottomNav />
    </div>
  );
}

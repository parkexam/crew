/** 경량 툴팁 스캐폴드. 브라우저 기본 title 속성으로 충분한 화면들을 위해 얇게 유지한다. */
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TooltipContext = createContext<{ delay?: number }>({});

export function TooltipProvider({
  children,
  delay,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return <TooltipContext.Provider value={{ delay }}>{children}</TooltipContext.Provider>;
}

export function Tooltip({ children }: { children: ReactNode }) {
  const { delay } = useContext(TooltipContext);
  return <span data-tooltip-delay={delay} className="inline-flex">{children}</span>;
}

export function TooltipTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function TooltipContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none ml-1 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

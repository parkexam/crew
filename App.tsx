import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import { clearSession, useHasSession } from "./lib/session";
import { BrandMark } from "./components/AppShell";
import Welcome from "./pages/Welcome";
import Home from "./pages/Home";
import Run from "./pages/Run";
import Crew from "./pages/Crew";
import Goals from "./pages/Goals";
import Balance from "./pages/Balance";

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink text-paper">
      <BrandMark tone="light" />
      <div className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/40">
        <Loader2 size={12} className="animate-spin text-track" />
        발 맞추는 중
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/run" component={Run} />
      <Route path="/crew" component={Crew} />
      <Route path="/goals" component={Goals} />
      <Route path="/balance" component={Balance} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const hasSession = useHasSession();
  const me = trpc.fitness.me.useQuery(undefined, {
    enabled: hasSession,
    retry: false,
    staleTime: 60_000,
  });

  const sessionExpired = me.isError && me.error.message.includes("RUNNER_REQUIRED");

  useEffect(() => {
    if (sessionExpired) clearSession();
  }, [sessionExpired]);

  let content;

  if (!hasSession) {
    content = <Welcome />;
  } else if (me.isLoading || sessionExpired) {
    content = <Splash />;
  } else if (me.isError) {
    content = (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
        <BrandMark />
        <p className="mt-2 text-[13px] font-bold text-ink">기록 서버에 연결하지 못했어요</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          잠시 후 다시 시도해 주세요. 계속되면 페이지를 새로고침해 주세요.
        </p>
        <button type="button" onClick={() => me.refetch()} className="btn-primary mt-2">
          다시 시도
        </button>
      </div>
    );
  } else if (!me.data) {
    content = <Welcome />;
  } else {
    content = <Router />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {content}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

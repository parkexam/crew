import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandMark } from "./AppShell";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
        <BrandMark />
        <p className="mt-2 text-[13px] font-bold text-ink">화면을 그리다 문제가 생겼어요</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          기록은 기기에 그대로 남아 있어요. 새로고침하면 이어서 볼 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary mt-2"
        >
          새로고침
        </button>
      </div>
    );
  }
}

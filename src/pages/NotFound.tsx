import { useLocation } from "wouter";
import { BrandMark } from "@/components/AppShell";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
      <BrandMark />
      <p className="display mt-3 text-[46px] leading-none text-ink">404</p>
      <p className="text-[13px] font-bold text-ink">페이지를 찾지 못했어요</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        주소가 바뀌었거나 아직 만들지 않은 화면이에요. 홈으로 돌아가 이어서 달려볼까요.
      </p>
      <button type="button" onClick={() => navigate("/")} className="btn-primary mt-3">
        홈으로 돌아가기
      </button>
    </div>
  );
}

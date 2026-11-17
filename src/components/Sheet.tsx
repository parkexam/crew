import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div className="animate-rise relative flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-line bg-card sm:rounded-[14px]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3.5 pt-3">
          <div className="flex-1">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <h2 className="text-[15px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-paper-deep"
            aria-label="닫기"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line bg-card px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

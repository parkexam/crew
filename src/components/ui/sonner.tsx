/**
 * 앱 전역 토스트. 현재 화면들은 자체 시트/인라인 안내로 결과를 보여주므로
 * 알림이 발생했을 때만 간단한 스택을 렌더한다(외부 의존성 없이 동작).
 */
import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string };

const listeners = new Set<(message: string) => void>();

/** 어디서든 호출 가능한 토스트. */
export function toast(message: string): void {
  listeners.forEach(listener => listener(message));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const listener = (message: string) => {
      nextId += 1;
      const id = nextId;
      setItems(prev => [...prev, { id, message }]);
      window.setTimeout(() => {
        setItems(prev => prev.filter(item => item.id !== id));
      }, 2600);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-[86px] left-1/2 z-[60] flex w-full max-w-[480px] -translate-x-1/2 flex-col items-center gap-1.5 px-5">
      {items.map(item => (
        <p
          key={item.id}
          className="animate-rise rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-paper shadow-lg"
        >
          {item.message}
        </p>
      ))}
    </div>
  );
}

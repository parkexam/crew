import { useEffect, useState } from "react";

const STORAGE_KEY = "balmatchum.session.v1";
const SESSION_EVENT = "balmatchum:session-changed";

export type StoredSession = {
  handle: string;
  token: string;
};

export function getSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.handle || !parsed.token) return null;
    return { handle: parsed.handle, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 저장 공간을 사용할 수 없는 브라우저는 세션 없이 동작한다.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function sessionHeaders(): Record<string, string> {
  const session = getSession();
  if (!session) return {};
  return {
    "x-runner-handle": session.handle,
    "x-runner-token": session.token,
  };
}

export function notifySessionChanged(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** 세션 저장소 변화를 구독해 로그인 여부를 상태로 노출한다. */
export function useHasSession(): boolean {
  const [hasSession, setHasSession] = useState(() => Boolean(getSession()));

  useEffect(() => {
    const sync = () => setHasSession(Boolean(getSession()));
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return hasSession;
}

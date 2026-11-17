import { useEffect, useReducer, useMemo } from "react";
import * as api from "./api";
import { notify, subscribe } from "./db";
import { getSession, SESSION_EVENT } from "./session";

/**
 * tRPC 클라이언트 대체 구현.
 *
 * 화면 코드는 `trpc.fitness.dashboard.useQuery()` 처럼 원래 tRPC + React Query 훅을
 * 그대로 쓰고, 이 모듈이 localStorage 기반 스토어를 React Query와 같은 형태
 * (data / isLoading / isError / error / refetch, mutate / isPending, utils.invalidate)로
 * 감싸서 실제로 동작하게 한다.
 */

type QueryOptions = {
  enabled?: boolean;
  staleTime?: number;
  retry?: boolean | number;
};

type MutationCallbacks<TInput, TResult> = {
  onSuccess?: (data: TResult, input: TInput) => unknown;
  onError?: (error: Error) => unknown;
};

type QueryResult<T> = {
  data: T | null;
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
};

/** 스토어 변경(기록 추가/삭제, 세션 변경, 다른 탭의 변경)에 반응해 다시 그린다. */
function useStoreRevision(): () => void {
  const [revision, force] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const bump = () => force();
    const unsubscribe = subscribe(bump);
    window.addEventListener(SESSION_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      unsubscribe();
      window.removeEventListener(SESSION_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  // revision 값을 읽어야 이 훅을 쓰는 컴포넌트가 다시 렌더된다.
  void revision;

  return force;
}

function useQueryImpl<T>(fetcher: () => T, options?: QueryOptions): QueryResult<T> {
  const force = useStoreRevision();
  const enabled = options?.enabled ?? true;

  let data: T | null = null;
  let error: Error | null = null;

  if (enabled) {
    try {
      data = fetcher();
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught));
    }
  }

  return {
    data,
    error,
    isError: error !== null,
    isLoading: false,
    refetch: force,
  };
}

/** React의 useState를 reducer 형태로 쓰기 위한 별칭(지연 갱신만 사용한다). */
function usePending(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useReducer((_: boolean, next: boolean) => next, false);
  return [value, setValue];
}

/* ------------------------------------------------------------------ */

function createInvalidator() {
  const invalidate = () => {
    notify();
    return Promise.resolve();
  };
  return { invalidate };
}

export function useUtils() {
  return useMemo(() => {
    const leaf = createInvalidator();
    return {
      fitness: {
        invalidate: leaf.invalidate,
        me: leaf,
        dashboard: leaf,
        setGoals: leaf,
        createSession: leaf,
        updateProfile: leaf,
        goals: { invalidate: leaf.invalidate, overview: leaf },
        crew: {
          invalidate: leaf.invalidate,
          overview: leaf,
          create: leaf,
          join: leaf,
          leave: leaf,
        },
        run: { invalidate: leaf.invalidate, list: leaf, log: leaf, remove: leaf },
        balance: {
          invalidate: leaf.invalidate,
          overview: leaf,
          logWorkout: leaf,
          removeWorkout: leaf,
        },
      },
    };
  }, []);
}

function useMutationHook<TInput, TResult>(
  exec: (input: TInput) => TResult,
  callbacks?: MutationCallbacks<TInput, TResult>,
) {
  const [pending, setPending] = usePending();
  const force = useStoreRevision();

  return useMemo(() => {
    const mutateAsync = async (input: TInput): Promise<TResult> => {
      setPending(true);
      try {
        const result = await exec(input);
        await callbacks?.onSuccess?.(result, input);
        return result;
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        callbacks?.onError?.(error);
        throw error;
      } finally {
        setPending(false);
        force();
      }
    };

    const mutate = (input?: TInput): void => {
      void mutateAsync(input as TInput).catch(() => undefined);
    };

    return { mutate, mutateAsync, isPending: pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbacks?.onSuccess, callbacks?.onError, pending]);
}

export const trpc = {
  useUtils,
  fitness: {
    me: {
      useQuery: (_input?: undefined, options?: QueryOptions) =>
        useQueryImpl<api.SessionPayload | null>(() => api.me(), options),
    },
    createSession: {
      useMutation: (callbacks?: MutationCallbacks<Parameters<typeof api.createSession>[0], ReturnType<typeof api.createSession>>) =>
        useMutationHook(api.createSession, callbacks),
    },
    setGoals: {
      useMutation: (callbacks?: MutationCallbacks<Parameters<typeof api.setGoals>[0], ReturnType<typeof api.setGoals>>) =>
        useMutationHook(api.setGoals, callbacks),
    },
    dashboard: {
      useQuery: (_input?: undefined, options?: QueryOptions) =>
        useQueryImpl(() => api.dashboard(), options),
    },
    goals: {
      overview: {
        useQuery: (_input?: undefined, options?: QueryOptions) =>
          useQueryImpl(() => api.goals(), options),
      },
    },
    crew: {
      overview: {
        useQuery: (_input?: undefined, options?: QueryOptions) =>
          useQueryImpl(() => api.crewOverview(), options),
      },
      create: {
        useMutation: (callbacks?: MutationCallbacks<Parameters<typeof api.createCrew>[0], ReturnType<typeof api.createCrew>>) =>
          useMutationHook(api.createCrew, callbacks),
      },
      join: {
        useMutation: (callbacks?: MutationCallbacks<{ code: string }, ReturnType<typeof api.joinCrew>>) =>
          useMutationHook((input: { code: string }) => api.joinCrew(input.code), callbacks),
      },
      leave: {
        useMutation: (callbacks?: MutationCallbacks<void, ReturnType<typeof api.leaveCrew>>) =>
          useMutationHook(() => api.leaveCrew(), callbacks),
      },
    },
    run: {
      log: {
        useMutation: (callbacks?: MutationCallbacks<Parameters<typeof api.logRun>[0], ReturnType<typeof api.logRun>>) =>
          useMutationHook(api.logRun, callbacks),
      },
      list: {
        useQuery: (input?: { limit?: number }, options?: QueryOptions) =>
          useQueryImpl(() => api.listRuns(input?.limit ?? 20), options),
      },
      remove: {
        useMutation: (callbacks?: MutationCallbacks<{ id: number }, ReturnType<typeof api.deleteRun>>) =>
          useMutationHook((input: { id: number }) => api.deleteRun(input.id), callbacks),
      },
    },
    balance: {
      overview: {
        useQuery: (_input?: undefined, options?: QueryOptions) =>
          useQueryImpl(() => api.balanceOverview(), options),
      },
      logWorkout: {
        useMutation: (callbacks?: MutationCallbacks<Parameters<typeof api.logWorkout>[0], ReturnType<typeof api.logWorkout>>) =>
          useMutationHook(api.logWorkout, callbacks),
      },
      removeWorkout: {
        useMutation: (callbacks?: MutationCallbacks<{ id: number }, ReturnType<typeof api.deleteWorkout>>) =>
          useMutationHook((input: { id: number }) => api.deleteWorkout(input.id), callbacks),
      },
    },
  },
};

/** 세션이 있는지 여부(훅 밖에서도 확인 가능). */
export function hasStoredSession(): boolean {
  return getSession() !== null;
}

import { useEffect, useRef, useState } from "react";

export type ReadState<T> = { state: "loading" | "unavailable" | "error" | "ready"; value?: T };

/** A read belongs to its current scope, including the render before effects run. */
export function useEvidenceRead<T>(scope: string, read: () => Promise<T | null | undefined>, enabled = true, recoveredFocus?: React.RefObject<HTMLElement | null>) {
  const [attempt, setAttempt] = useState(0);
  const [record, setRecord] = useState<{ scope: string; read: typeof read; attempt: number; result: ReadState<T> }>();
  const retryFocus = useRef(false);
  useEffect(() => {
    if (retryFocus.current && record?.scope === scope && record.read === read && record.attempt === attempt && record.result.state === "ready") {
      retryFocus.current = false;
      recoveredFocus?.current?.focus();
    }
  }, [record, scope, read, attempt, recoveredFocus]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void read().then((value) => {
      if (alive) setRecord({ scope, read, attempt, result: value == null ? { state: "unavailable" } : { state: "ready", value } });
    }).catch(() => { if (alive) setRecord({ scope, read, attempt, result: { state: "error" } }); });
    return () => { alive = false; };
  }, [scope, read, attempt, enabled]);
  const result: ReadState<T> = record?.scope === scope && record.read === read && record.attempt === attempt ? record.result : { state: "loading" };
  return { ...result, retry: () => { retryFocus.current = true; setAttempt((previous) => previous + 1); } };
}

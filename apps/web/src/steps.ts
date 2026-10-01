export type Phase = "start" | "progress" | "result" | "evidence" | "export";

export const STEPS: { id: Phase; label: string }[] = [
  { id: "start", label: "탐지 시작" },
  { id: "progress", label: "탐지 진행" },
  { id: "result", label: "탐지 결과" },
  { id: "evidence", label: "탐지 근거" },
  { id: "export", label: "검증·내보내기" },
];

export type StepState = {
  id: Phase;
  label: string;
  /** Completion comes from actually visited phases, never from position. */
  done: boolean;
  /** Current phase gets aria-current="step". */
  current: boolean;
  className: "done" | "current" | "todo";
};

/**
 * Derive step states from the phases the user actually went through.
 * A skipped step (e.g. Evidence skipped via 결과 검증 from 탐지 결과) is
 * never marked done just because it is positionally behind the current step.
 */
export function stepStates(phase: Phase, visited: ReadonlySet<Phase>): StepState[] {
  return STEPS.map((s) => {
    const done = visited.has(s.id) && s.id !== phase;
    const current = s.id === phase;
    return {
      id: s.id,
      label: s.label,
      done,
      current,
      className: done ? "done" : current ? "current" : "todo",
    };
  });
}

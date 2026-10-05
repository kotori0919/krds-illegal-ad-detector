export type Phase = "start" | "progress" | "result" | "evidence";
export type Stage = "start" | "progress" | "result";

export const STEPS: { id: Stage; label: string }[] = [
  { id: "start", label: "점검 설정" },
  { id: "progress", label: "사이트 점검" },
  { id: "result", label: "결과 검토" },
];

export type StepState = {
  id: Stage;
  label: string;
  done: boolean;
  /** Current phase gets aria-current="step". */
  current: boolean;
  className: "done" | "current" | "todo";
};

/**
 * Evidence inspection is an action inside the result stage.
 */
export function stepStates(phase: Phase): StepState[] {
  const currentStage: Stage = phase === "evidence" ? "result" : phase;
  const currentIndex = STEPS.findIndex((step) => step.id === currentStage);
  return STEPS.map((s) => {
    const done = STEPS.findIndex((step) => step.id === s.id) < currentIndex;
    const current = s.id === currentStage;
    return {
      id: s.id,
      label: s.label,
      done,
      current,
      className: done ? "done" : current ? "current" : "todo",
    };
  });
}

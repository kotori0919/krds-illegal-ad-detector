import type { ScanIssue } from "@krds-detector/contracts";

export function retryAfterMs(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const milliseconds = /^\d+$/.test(trimmed) ? Number(trimmed) * 1000 : Date.parse(trimmed) - now;
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;
  // Preserve the server's interval. Admission decides whether the remaining
  // scan budget can afford it; shortening this value violates Retry-After.
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(milliseconds));
}

export interface AccessDocument {
  title: string;
  passwordForm: boolean;
  challengeElement: boolean;
}

/** Positive mitigation evidence wins over generic HTTP status or proxy identity. */
export function classifyAccess(status: number, headers: Record<string, string>, document?: AccessDocument): ScanIssue | undefined {
  if (headers["cf-mitigated"]?.trim().toLowerCase() === "challenge") return { kind: "challenge", retryable: false };
  const challengeTitle = /^(just a moment|attention required|verify (?:you are|you're) human|security (?:check|verification)|보안 확인|자동입력 방지)/i;
  if (document && challengeTitle.test(document.title.trim()) && document.challengeElement) return { kind: "challenge", retryable: false };
  if (status === 429) {
    const delay = retryAfterMs(headers["retry-after"]);
    return { kind: "rate-limit", retryable: true, ...(delay === undefined ? {} : { retryAfterMs: delay }) };
  }
  if (status === 401 || status === 407) return { kind: "login-required", retryable: false };
  if (status === 403 || status === 451) return { kind: "denied", retryable: false };
  if (status === 0 || status >= 400) return { kind: "navigation", retryable: status === 0 || status >= 500 };
  if (document?.passwordForm && /(?:log[ -]?in|sign[ -]?in|로그인|인증 필요)/i.test(document.title)) {
    return { kind: "login-required", retryable: false };
  }
  return undefined;
}

export function classifyPageError(error: unknown, timedOut: boolean, navigating: boolean): ScanIssue {
  if (timedOut || (error instanceof Error && (error.name === "TimeoutError" || /deadline|timed? ?out/i.test(error.message)))) {
    return { kind: "timeout", retryable: true };
  }
  return { kind: navigating ? "navigation" : "unknown", retryable: navigating };
}

import { useEffect, useMemo, useReducer } from "react";
import type { HostBridge, OpenCase, ReviewRecord } from "@krds-detector/contracts";

type Records = Record<string, ReviewRecord>;
interface ReviewState {
  records: Records; opened?: OpenCase; revision: number;
  modified: Set<string>; status: "loading" | "saved" | "saving" | "unsaved" | "error";
  error?: string; loaded: boolean; inFlight: boolean; timer?: ReturnType<typeof setTimeout>;
  loadToken: number;
}
const index = (records: ReviewRecord[]): Records => Object.fromEntries(records.map((record) => [record.findingId, record]));

/** One serialized writer per case. Responses advance revisions, never replace newer local edits. */
export class CaseReviewWriter {
  readonly states = new Map<string, ReviewState>();
  constructor(private readonly host: HostBridge, private readonly changed: () => void) {}

  state(caseId: string): ReviewState {
    let value = this.states.get(caseId);
    if (!value) {
      value = { records: {}, revision: 0, modified: new Set(), status: "loading", loaded: false, inFlight: false, loadToken: 0 };
      this.states.set(caseId, value);
    }
    return value;
  }

  async load(caseId: string, retry = false): Promise<void> {
    const state = this.state(caseId);
    if (state.loaded && !retry) return;
    const token = ++state.loadToken;
    state.status = "loading"; state.error = undefined; this.changed();
    try {
      const opened = await this.host.openCase(caseId);
      if (state.loadToken !== token) return;
      const records = index(opened.review.records);
      // Recovery merges remote records, keeping each locally modified record.
      for (const id of state.modified) records[id] = state.records[id]!;
      state.records = records; state.revision = opened.review.revision; state.opened = opened; state.loaded = true;
      state.status = state.modified.size ? "unsaved" : "saved";
      this.changed();
      if (state.modified.size) void this.flush(caseId);
    } catch (error) {
      if (state.loadToken !== token) return;
      state.status = "error"; state.error = String(error); this.changed();
    }
  }

  edit(caseId: string, update: (previous: Records) => Records): void {
    const state = this.state(caseId);
    const previous = state.records; const next = update(previous);
    for (const [id, record] of Object.entries(next)) if (record !== previous[id]) state.modified.add(id);
    state.records = next;
    if (state.status !== "error") state.status = "unsaved";
    this.changed();
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.timer = undefined; void this.flush(caseId); }, 300);
  }

  async flush(caseId: string): Promise<void> {
    const state = this.state(caseId);
    if (state.inFlight || !state.loaded || !state.modified.size || state.status === "error") return;
    state.inFlight = true; state.status = "saving";
    const snapshotRecords = state.records;
    const snapshot = Object.values(state.records);
    this.changed();
    try {
      const saved = await this.host.saveCaseReview(caseId, state.revision, snapshot);
      state.revision = saved.revision;
      if (state.opened) state.opened = { ...state.opened, review: saved };
      // Clear only edits included in this transaction. A later edit to another
      // record must not keep an already saved record falsely marked dirty.
      for (const id of state.modified) if (state.records[id] === snapshotRecords[id]) state.modified.delete(id);
      state.status = state.modified.size ? "unsaved" : "saved";
    } catch (error) {
      state.status = "error"; state.error = String(error);
    } finally {
      state.inFlight = false; this.changed();
    }
    if (state.modified.size && state.status !== "error") void this.flush(caseId);
  }
}

export function useCaseReview(host: HostBridge | undefined, caseId: string | undefined, active: boolean) {
  const [, changed] = useReducer((value: number) => value + 1, 0);
  const writer = useMemo(() => host ? new CaseReviewWriter(host, changed) : undefined, [host]);
  useEffect(() => { if (writer && caseId && active) void writer.load(caseId); }, [writer, caseId, active]);
  const current = writer && caseId ? writer.state(caseId) : undefined;
  return {
    records: current?.records ?? {}, opened: current?.opened, status: current?.status ?? "loading", error: current?.error,
    sessions: Object.fromEntries([...(writer?.states ?? [])].map(([id, state]) => [id, state.records])),
    edit: (update: (previous: Records) => Records) => { if (writer && caseId) writer.edit(caseId, update); },
    retry: () => { if (writer && caseId) void writer.load(caseId, true); },
  };
}

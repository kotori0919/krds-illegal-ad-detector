import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { OfficialResult } from "@krds-detector/contracts";
import { ReviewCollection } from "../src/screens/ReviewCollection.js";

const result = JSON.parse(readFileSync("packages/evidence/test/fixtures/sample_result_617_sanitized.json", "utf8")) as OfficialResult;
afterEach(cleanup);
it("keeps a relation-selected original open without clearing filters, then honors a new filter change", () => {
  function Workspace() {
    const [query, setQuery] = useState("f372");
    const [selected, setSelected] = useState<string | undefined>(result.findings[0]!.id);
    return <>{selected ? <h2>열린 원본 {selected}</h2> : null}<ReviewCollection findings={result.findings} query={query} onQueryChange={setQuery}
      filter="ALL" onFilterChange={() => {}} view="findings" onViewChange={() => {}} reviewedIds={new Set()} onReviewMany={() => {}}
      onEvidence={() => {}} selectedFindingId={selected} allowHiddenSelection onSelectionHidden={() => setSelected(undefined)} /></>;
  }
  render(<Workspace />);
  expect(screen.getByRole("heading", { name: `열린 원본 ${result.findings[0]!.id}` })).toBeDefined();
  expect((screen.getByLabelText("결과 검색") as HTMLInputElement).value).toBe("f372");
  fireEvent.change(screen.getByLabelText("결과 검색"), { target: { value: "no match" } });
  expect(screen.queryByRole("heading", { name: `열린 원본 ${result.findings[0]!.id}` })).toBeNull();
  expect((screen.getByLabelText("결과 검색") as HTMLInputElement).value).toBe("no match");
});
it("lets an operator find f372, enumerate records, paginate and confirm scoped review without editing JSON", () => {
  const before = JSON.stringify(result);
  let selection: string[] = [];
  function Workspace() {
    const [query, setQuery] = useState("");
    const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
    return <ReviewCollection findings={result.findings} query={query} onQueryChange={setQuery} filter="ALL" onFilterChange={() => {}}
      view="findings" onViewChange={() => {}} reviewedIds={ids} onReviewMany={(items) => setIds(new Set(items))}
      onEvidence={(_id, context) => { selection = context; }} onSelectionHidden={() => {}} />;
  }
  render(<Workspace />);
  expect(screen.getByText(/19개 항목/)).toBeDefined();
  expect(screen.getAllByRole("button", { name: "근거 보기", exact: true })).toHaveLength(19);
  fireEvent.change(screen.getByLabelText("결과 검색"), { target: { value: "f372" } });
  fireEvent.click(screen.getByRole("button", { name: "근거 보기", exact: true }));
  expect(selection).toEqual(["f372"]);
  fireEvent.click(screen.getByRole("button", { name: "검색·필터 초기화" }));
  fireEvent.click(screen.getByRole("button", { name: "전체 기록" }));
  expect(screen.getAllByRole("button", { name: "근거 보기", exact: true })).toHaveLength(20);
  fireEvent.click(screen.getByRole("button", { name: "다음 목록" }));
  expect(screen.getByText(/2 \/ 31 페이지/)).toBeDefined();
  fireEvent.change(screen.getByLabelText("목록 표시 개수"), { target: { value: "50" } });
  expect(screen.getAllByRole("button", { name: "근거 보기", exact: true })).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: /현재 목록 50건 검토 완료/ }));
  const confirm = screen.getByRole("dialog", { name: "검토 범위 확인" });
  expect(within(confirm).getByText(/50건/)).toBeDefined();
  fireEvent.click(within(confirm).getByRole("button", { name: "검토 완료로 표시" }));
  expect(screen.getByText(/검토 완료 50건 \/ 전체 617건/)).toBeDefined();
  expect(JSON.stringify(result)).toBe(before);
});

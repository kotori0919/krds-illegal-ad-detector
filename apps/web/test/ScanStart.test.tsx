// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScanStart } from "../src/screens/ScanStart.js";
import type { HostBridge } from "@krds-detector/contracts";

afterEach(cleanup);

function hostStub(startScan: HostBridge["startScan"]): HostBridge {
  return {
    startScan,
    cancelScan: vi.fn(async () => {}),
    onScanEvent: () => () => {},
  } as unknown as HostBridge;
}

function ok() {
  return vi.fn(async () => ({ id: "s1" }));
}

/** onStarted flips state so the form unmounts cleanly, mirroring real App usage. */
function Harness({ startScan }: { startScan: HostBridge["startScan"] }) {
  const [, setDone] = useState(false);
  return <ScanStart host={hostStub(startScan)} onStarted={() => setDone(true)} />;
}

function byId(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

function advanced() {
  return document.querySelector("details.advanced") as HTMLDetailsElement;
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

describe("ScanStart field validation", () => {
  it("marks the pages input, not the URL input, when the page limit is out of range", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    fireEvent.change(byId("limit-pages"), { target: { value: "5000" } });
    submit();

    expect(byId("limit-pages").getAttribute("aria-invalid")).toBe("true");
    expect(byId("limit-pages").getAttribute("aria-describedby")).toBe(
      "limit-pages-error",
    );
    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
    expect(byId("entry-url").getAttribute("aria-describedby")).toBe("scan-hint");
    expect(document.getElementById("entry-url-error")).toBeNull();
    expect(
      document.getElementById("limit-pages-error")?.textContent,
    ).toBe("최대 페이지 수는 1부터 2000까지 입력해 주세요.");
    expect(start).not.toHaveBeenCalled();
  });

  it("expands the collapsed 고급 설정 and focuses the depth input on an advanced-field error", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    fireEvent.change(byId("limit-depth"), { target: { value: "99" } });

    expect(advanced().open).toBe(false);
    submit();

    expect(advanced().open).toBe(true);
    expect(document.activeElement).toBe(byId("limit-depth"));
    expect(byId("limit-depth").getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText("탐색 깊이는 0부터 10까지 입력해 주세요."),
    ).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps the URL error behaviour: empty URL marks entry-url, focuses it, and preserves ids", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    submit();

    expect(byId("entry-url").getAttribute("aria-invalid")).toBe("true");
    expect(byId("entry-url").getAttribute("aria-describedby")).toBe(
      "entry-url-error",
    );
    expect(document.getElementById("entry-url-error")?.getAttribute("role")).toBe(
      "alert",
    );
    expect(
      screen.getByText("검사할 웹사이트 주소를 입력해 주세요."),
    ).toBeTruthy();
    expect(document.getElementById("scan-hint")).toBeTruthy();
    expect(document.activeElement).toBe(byId("entry-url"));
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) URL and reports the timeout error on its own field", () => {
    render(<Harness startScan={ok()} />);
    fireEvent.change(byId("entry-url"), { target: { value: "ftp://example.kr/" } });
    fireEvent.change(byId("limit-timeout"), { target: { value: "10" } });
    submit();

    expect(byId("entry-url").getAttribute("aria-describedby")).toBe(
      "entry-url-error",
    );
    expect(
      screen.getByText("http(s)로 시작하는 올바른 주소를 입력해 주세요."),
    ).toBeTruthy();
    expect(document.getElementById("limit-timeout-error")?.textContent).toBe(
      "제한 시간은 60초부터 1750초까지 입력해 주세요.",
    );
    expect(byId("limit-timeout").getAttribute("aria-describedby")).toBe(
      "limit-timeout-error",
    );
    // URL is first in FIELD_ORDER, so focus goes there even with two errors.
    expect(document.activeElement).toBe(byId("entry-url"));
  });

  it("submits valid values and clears prior field errors", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    submit();
    expect(byId("entry-url").getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    submit();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toEqual({
      entryUrl: "https://example.kr/",
      topic: undefined,
      limits: { maxPages: 200, maxDepth: 4, timeoutSec: 1500 },
    });
    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
  });

  it("reports a host failure at form level without marking the URL input invalid", async () => {
    const start = vi.fn(async () => {
      throw new Error("탐지 세션을 만들지 못했습니다.");
    });
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    submit();
    await vi.waitFor(() =>
      expect(screen.getByText("탐지 세션을 만들지 못했습니다.")).toBeTruthy(),
    );

    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
    expect(byId("entry-url").getAttribute("aria-describedby")).toBe("scan-hint");
    expect(
      document.getElementById("scan-form-error")?.getAttribute("role"),
    ).toBe("alert");
  });

  it("exposes min/max matching the validator bounds on the advanced limits", () => {
    render(<Harness startScan={ok()} />);
    expect(byId("limit-pages").getAttribute("min")).toBe("1");
    expect(byId("limit-pages").getAttribute("max")).toBe("2000");
    expect(byId("limit-depth").getAttribute("min")).toBe("0");
    expect(byId("limit-depth").getAttribute("max")).toBe("10");
    expect(byId("limit-timeout").getAttribute("min")).toBe("60");
    expect(byId("limit-timeout").getAttribute("max")).toBe("1750");
  });
});
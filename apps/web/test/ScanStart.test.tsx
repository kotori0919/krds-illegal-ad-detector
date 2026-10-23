// @vitest-environment jsdom
import { warpHost } from "./evidence-host.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScanStart } from "../src/screens/ScanStart.js";
import type { HostBridge } from "@krds-detector/contracts";

afterEach(cleanup);

it("offers shared connection setup after start failure without registering or losing the URL", async () => {
  let devices = 0;
  const host = hostStub(async () => { throw new Error("private config path"); });
  host.registerWarp = async () => { devices++; return { state: "unregistered" }; };
  function Workspace() {
    const [setup, setSetup] = useState(false);
    return <>{setup ? <h2>공유 연결 설정</h2> : null}<ScanStart host={host} onStarted={() => {}}
      onWarpSetup={() => setSetup(true)} /></>;
  }
  render(<Workspace />);
  fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
  fireEvent.click(screen.getByLabelText(/앱 전용 WARP/));
  submit();
  fireEvent.click(await screen.findByRole("button", { name: "WARP 연결 설정 확인" }));
  expect(screen.getByRole("heading", { name: "공유 연결 설정" })).toBeTruthy();
  expect(byId("entry-url").value).toBe("https://example.kr/");
  expect(screen.queryByText("private config path")).toBeNull();
  expect(devices).toBe(0);
});

function hostStub(startScan: HostBridge["startScan"]): HostBridge {
  return { ...warpHost(),
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

function chooseCustom() {
  fireEvent.click(screen.getByText("상세 설정"));
  fireEvent.click(screen.getByLabelText("직접 설정"));
}

describe("ScanStart field validation", () => {
  it("marks the pages input, not the URL input, when the page limit is out of range", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    chooseCustom();
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

  it("focuses the depth input on a custom-scope error", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    chooseCustom();
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    fireEvent.change(byId("limit-depth"), { target: { value: "99" } });

    expect(advanced().open).toBe(true);
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
    chooseCustom();
    fireEvent.change(byId("entry-url"), { target: { value: "ftp://example.kr/" } });
    fireEvent.change(byId("limit-timeout"), { target: { value: "10" } });
    submit();

    expect(byId("entry-url").getAttribute("aria-describedby")).toBe(
      "entry-url-error",
    );
    expect(
      screen.getByText("http(s)로 시작하는 올바른 주소를 입력해 주세요."),
    ).toBeTruthy();
    expect(document.getElementById("limit-timeout-error")?.getAttribute("role")).toBe("alert");
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
      connection: "direct",
      limits: { maxPages: 200, maxDepth: 4, timeoutSec: 1500 },
    });
    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
  });

  it("uses the reduced page, depth and time limits for quick scope", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    fireEvent.click(screen.getByText("상세 설정"));
    fireEvent.click(screen.getByLabelText(/빠른 점검/));
    expect(document.getElementById("limit-pages")).toBeNull();
    submit();
    expect(start.mock.calls[0][0].limits).toEqual({ maxPages: 50, maxDepth: 2, timeoutSec: 600 });
  });

  it("reports a host failure at form level without marking the URL input invalid", async () => {
    const start = vi.fn(async () => {
      throw new Error("탐지 세션을 만들지 못했습니다.");
    });
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    submit();
    await vi.waitFor(() =>
      expect(screen.getByText(/점검을 시작하지 못했습니다/)).toBeTruthy(),
    );

    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
    expect(byId("entry-url").getAttribute("aria-describedby")).toBe("scan-hint");
    expect(
      document.getElementById("scan-form-error")?.getAttribute("role"),
    ).toBe("alert");
  });

  it("shows an actionable Korean error without exposing host internals", async () => {
    const start = vi.fn(async () => {
      throw "sidecar exploded";
    });
    render(<Harness startScan={start} />);
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    submit();
    await vi.waitFor(() =>
      expect(document.getElementById("scan-form-error")?.textContent).toMatch(/주소.*네트워크/),
    );
    expect(document.getElementById("scan-form-error")?.textContent).not.toContain("sidecar exploded");
  });

  it("blocks a duration beyond the configured ceiling and keeps focus on the field", () => {
    const start = ok();
    render(<Harness startScan={start} />);
    chooseCustom();
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    fireEvent.change(byId("limit-timeout"), { target: { value: "1501" } });
    submit();
    expect(start).not.toHaveBeenCalled();
    expect(byId("limit-timeout").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(byId("limit-timeout"));
    fireEvent.change(byId("limit-timeout"), { target: { value: "1500" } });
    submit();
    expect(byId("limit-timeout").hasAttribute("aria-invalid")).toBe(false);
  });
});
describe("ScanStart stale-error clearing (CUA-found)", () => {
  it("clears the URL error as soon as the user types a valid URL", () => {
    render(<Harness startScan={ok()} />);
    submit();
    expect(document.getElementById("entry-url-error")).toBeTruthy();
    fireEvent.change(byId("entry-url"), { target: { value: "https://example.kr/" } });
    expect(document.getElementById("entry-url-error")).toBeNull();
    expect(byId("entry-url").hasAttribute("aria-invalid")).toBe(false);
  });
});

it.each(["", "1.5"])("rejects a custom depth that is not a supplied integer: %s", value => {
  const start = ok();
  render(<Harness startScan={start} />);
  chooseCustom();
  fireEvent.change(byId("entry-url"), { target: { value: "https://agency.example/" } });
  fireEvent.change(byId("limit-depth"), { target: { value } });
  submit();
  expect(byId("limit-depth").getAttribute("aria-invalid")).toBe("true");
  expect(start).not.toHaveBeenCalled();
});

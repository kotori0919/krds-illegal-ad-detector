// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { HostBridge } from "@krds-detector/contracts";
import { AssetImage } from "../src/screens/AssetImage.js";
import { evidenceHost } from "./evidence-host.js";

afterEach(cleanup);

function showAsset(read: HostBridge["getEvidenceAsset"]) {
  const host = { getEvidenceAsset: read } as HostBridge;
  render(<AssetImage host={host} sessionId="imported-session" assetId="optional-image" alt="탐지 당시 화면" />);
}

describe("optional evidence image reads", () => {
  it("settles an absent imported image without an error or retry affordance", async () => {
    showAsset(evidenceHost().getEvidenceAsset);
    expect(await screen.findByText("이 결과에 저장된 수집 이미지가 없습니다.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "이미지 다시 불러오기" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("recovers a failed image read and restores focus to the image", async () => {
    let attempts = 0;
    showAsset(async () => {
      if (++attempts === 1) throw new Error("temporary asset failure");
      return { assetId: "optional-image", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" };
    });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "이미지 다시 불러오기" }));
    const image = await screen.findByRole("img", { name: "탐지 당시 화면" });
    expect(image.getAttribute("src")).toBe("data:image/png;base64,YQ==");
    expect(document.activeElement).toBe(image);
    expect(screen.queryByRole("button", { name: "이미지 다시 불러오기" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("removes failure recovery after a retry successfully establishes absence", async () => {
    let attempts = 0;
    showAsset(async () => {
      if (++attempts === 1) throw new Error("temporary asset failure");
      return undefined;
    });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "이미지 다시 불러오기" }));
    expect(await screen.findByText("이 결과에 저장된 수집 이미지가 없습니다.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "이미지 다시 불러오기" })).toBeNull();
  });
});

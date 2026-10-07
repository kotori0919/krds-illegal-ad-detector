import { useCallback, useRef } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import { useEvidenceRead } from "./evidence-read.js";

export function AssetImage({ host, sessionId, assetId, alt, width, height }: {
  host: HostBridge; sessionId: string; assetId: string; alt: string; width?: number; height?: number;
}) {
  const read = useCallback(() => host.getEvidenceAsset(sessionId, assetId), [host, sessionId, assetId]);
  const imageRef = useRef<HTMLImageElement>(null);
  const asset = useEvidenceRead(`${sessionId}\0${assetId}`, read, true, imageRef);
  if (asset.state === "ready" && asset.value) return <img ref={imageRef} tabIndex={-1} src={asset.value.dataUrl} alt={alt} width={width} height={height} />;
  return <div>
    <p role={asset.state === "error" ? "alert" : "status"}>{asset.state === "loading" ? "이미지를 불러오는 중입니다."
      : asset.state === "error" ? "저장된 이미지를 불러오지 못했습니다. 점검 결과는 유지됩니다." : "이 세션의 수집 이미지를 사용할 수 없습니다."}</p>
    {asset.state === "error" || asset.state === "unavailable" ? <button type="button" className="secondary" onClick={asset.retry}>이미지 다시 불러오기</button> : null}
  </div>;
}

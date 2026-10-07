import { useEffect, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";

export function AssetImage({ host, sessionId, assetId, alt, width, height }: {
  host: HostBridge; sessionId: string; assetId: string; alt: string; width?: number; height?: number;
}) {
  const [source, setSource] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setSource(undefined); setLoaded(false);
    void host.getEvidenceAsset(sessionId, assetId).then((asset) => {
      if (alive) setSource(asset?.dataUrl);
    }).catch(() => undefined).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [host, sessionId, assetId]);
  return source ? <img src={source} alt={alt} width={width} height={height} />
    : <p role="status">{loaded ? "수집한 이미지를 사용할 수 없습니다." : "이미지를 불러오는 중입니다."}</p>;
}

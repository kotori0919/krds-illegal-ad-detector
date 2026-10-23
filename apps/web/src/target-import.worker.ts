import { previewTargets } from "@krds-detector/evidence/target-import";

self.onmessage = async (event: MessageEvent<{ name: string; bytes: Uint8Array }>) => {
  try { self.postMessage({ preview: await previewTargets(event.data.name, event.data.bytes) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "파일을 읽지 못했습니다." }); }
};

import type { TargetPreview } from "@krds-detector/contracts";

/** Disposable offline parser: no target fetch, hard time and byte boundaries. */
export async function importTargets(file: File): Promise<TargetPreview> {
  if (file.size > 2 * 1024 * 1024) throw new Error("파일은 2MiB 이하로 선택해 주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const worker = new Worker(new URL("./target-import.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const finish = (): void => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(new Error("파일 해석 제한 시간(10초)을 초과했습니다.")); }, 10_000);
    worker.onerror = () => { finish(); reject(new Error("파일을 읽지 못했습니다. 형식과 내용을 확인해 주세요.")); };
    worker.onmessage = (event: MessageEvent<{ preview?: TargetPreview; error?: string }>) => {
      finish(); if (event.data.preview) resolve(event.data.preview); else reject(new Error(event.data.error));
    };
    worker.postMessage({ name: file.name, bytes }, [bytes.buffer]);
  });
}

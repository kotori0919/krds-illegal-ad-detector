import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    // Each integration file can launch real Chromium plus 1.3 GiB of ONNX
    // sessions. Running files concurrently on a 4-vCPU runner starves capture
    // deadlines and pushes cold OCR evidence past its 8 s contract window, so
    // files run one at a time. fileParallelism is a run-level option in Vitest,
    // not a per-project one, so it applies to both projects.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "packages",
          environment: "node",
          setupFiles: ["./tests/browser-fixture.ts"],
          include: ["packages/*/test/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/test/**/*.test.tsx"],
        },
      },
    ],
  },
});

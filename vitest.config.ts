import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    // Each integration file can launch several real Chromium/OCR workers.
    // Bound file concurrency so unrelated tests do not consume capture deadlines.
    maxWorkers: 2,
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

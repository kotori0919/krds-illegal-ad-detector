import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "packages",
          environment: "node",
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
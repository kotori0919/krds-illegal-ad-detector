import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/*.tsbuildinfo",
    "**/*.js",
    "**/*.d.ts",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
]);

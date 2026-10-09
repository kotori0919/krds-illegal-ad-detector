import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";

const nodeModules = builtinModules.filter(name => !name.startsWith("node:"));
const nodePaths = nodeModules.map(name => ({ name, message: "Node built-ins belong behind the host boundary." }));
const nodePattern = nodeModules.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

const browserImports = {
  paths: [...nodePaths, { name: "@krds-detector/evidence", message: "Use the documented browser-safe evidence subpaths instead of the Node-enabled root." }],
  patterns: [
    { group: ["node:*", "@krds-detector/scanner", "@krds-detector/scanner/**", "@krds-detector/detection", "@krds-detector/detection/**", "@krds-detector/synth-eval", "@krds-detector/synth-eval/**"],
      message: "Browser code uses contracts and browser-safe evidence subpaths; scanner/Node runtime belongs behind HostBridge." },
    { group: ["**/packages/*/src/**", "@krds-detector/*/src/**", "@krds-detector/*/dist/**"], message: "Use a public package entry point instead of a private implementation path." },
  ],
};
const browserDynamic = [{ selector: `ImportExpression[source.value=/^(node:|(${nodePattern.replaceAll("/", "\\/")})$|@krds-detector\\/(scanner|detection|synth-eval)(\\/|$)|@krds-detector\\/evidence$)/]`,
  message: "Dynamic imports obey the same browser/host boundary as static imports." }];

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/*.tsbuildinfo",
    "**/*.js",
    "**/*.d.ts",
    "src-tauri/target/**",
    "src-tauri/binaries/scanner-worker-*.mjs",
    "src-tauri/binaries/ocr-worker.mjs",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", browserImports],
      "no-restricted-syntax": ["error", ...browserDynamic],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/host/tauri.ts"],
    rules: {
      "no-restricted-imports": ["error", { ...browserImports, patterns: [...browserImports.patterns,
        { group: ["@tauri-apps/*", "@tauri-apps/**"], message: "Only host/tauri.ts may call Tauri; ordinary UI uses typed HostBridge." },
      ] }],
      "no-restricted-syntax": ["error", ...browserDynamic, { selector: "ImportExpression[source.value=/^@tauri-apps\\//]", message: "Only host/tauri.ts may dynamically load Tauri." }],
    },
  },
  {
    files: ["packages/detection/src/{text-policy,semantic,homoglyph,jamo}.ts"],
    rules: { "no-restricted-imports": ["error", { paths: nodePaths, patterns: [
      { group: ["node:*", "playwright*", "@tauri-apps/*", "@krds-detector/scanner", "@krds-detector/scanner/**"],
        message: "Pure text policy cannot depend on browser, native, filesystem or scanner adapters." },
    ] }] },
  },
  {
    files: ["benchmarks/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        URL: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        scrollY: "readonly",
        innerWidth: "readonly",
        getComputedStyle: "readonly",
      },
    },
  },
]);

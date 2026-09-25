import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",

    "**/*.cjs",
    "**/*.ps1",
    "**/*.bak",

    "**/*.before-*.ts",
    "**/*.before-*.tsx",
    "**/*.before-*.js",
    "**/*.before-*.jsx",
    "**/*.before-*.css",

    "focusly-dev-archive/**",
  ]),
]);
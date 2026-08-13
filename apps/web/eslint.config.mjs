import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler readiness rule — we don't set reactCompiler: true in
      // next.config.ts, so this doesn't affect runtime behavior yet. It also
      // flags the standard "fetch on mount" useEffect pattern used across
      // this app's client pages, which is correct, ignore-guarded code, not
      // a bug. Revisit if/when we actually opt into the React Compiler.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

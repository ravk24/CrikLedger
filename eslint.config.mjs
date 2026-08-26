import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 is flat-config native — no FlatCompat shim.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Sheets and tiles re-seed their local form state when they open
    // (the documented cure for prop/state drift after router.refresh()).
    // The React-Compiler-era rule wants a key-based remount instead;
    // that is a separate refactor across ~12 components, so it reports
    // as a warning until then rather than blocking the build.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    // The share routes build satori JSX inside the try that guards their
    // DB/auth work. satori renders synchronously inside ImageResponse,
    // so the rule's concern (React deferring the render past the catch)
    // does not apply here.
    files: ["app/api/share/**/*.tsx"],
    rules: { "react-hooks/error-boundaries": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "node_modules/**", "next-env.d.ts"]),
]);

export default eslintConfig;

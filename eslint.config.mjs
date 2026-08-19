import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='useEffect']",
          message: "Use derived state, event handlers, a query library, or useMountEffect instead.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
]);

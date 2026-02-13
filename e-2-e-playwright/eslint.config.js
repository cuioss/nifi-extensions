import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: { security },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "no-var": "error",
      "max-params": ["error", 5],
      camelcase: [
        "error",
        {
          allow: [
            "grant_type",
            "client_id",
            "client_secret",
            "access_token",
            "refresh_token",
            "token_type",
            "expires_in",
          ],
        },
      ],
      "security/detect-object-injection": "off",
      "security/detect-non-literal-regexp": "warn",
    },
  },
];

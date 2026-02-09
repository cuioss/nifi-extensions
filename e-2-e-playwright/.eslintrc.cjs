module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["security"],
  rules: {
    "no-console": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "prefer-const": "error",
    "no-var": "error",
    "max-params": ["error", 5],
    "camelcase": [
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
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
  },
  overrides: [
    {
      files: ["tests/**/*.spec.js", "tests/**/*.test.js"],
      rules: {
        "no-unused-vars": "warn",
      },
    },
  ],
};

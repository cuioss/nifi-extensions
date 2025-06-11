module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    "cypress/globals": true
  },
  extends: [
    "eslint:recommended",
    "plugin:cypress/recommended",
    "plugin:prettier/recommended"
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module"
  },
  plugins: ["cypress", "prettier"],
  rules: {
    "prettier/prettier": "error",
    "no-console": "warn",
    "no-unused-vars": "warn",
    "cypress/no-unnecessary-waiting": "warn",
    "cypress/unsafe-to-chain-command": "warn"
  }
};

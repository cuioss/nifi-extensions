module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:jsdoc/recommended",
    "plugin:prettier/recommended"
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  plugins: [
    "prettier",
    "jsdoc",
    "sonarjs",
    "security",
    "unicorn"
  ],
  rules: {
    // CUI Standards - Fundamental Rules
    "no-console": "warn", // Allow console for debugging but warn
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }], // Ignore vars starting with _
    "prefer-const": "error",
    "no-var": "error",

    // CUI Standards - Code Quality Rules
    "prettier/prettier": "error",

    // CUI Standards - JSDoc Documentation Requirements
    "jsdoc/require-description": "error",
    "jsdoc/require-param-description": "error",
    "jsdoc/require-returns-description": "error",
    "jsdoc/require-example": "warn",
    "jsdoc/no-undefined-types": "off",           // Turn off for Playwright - types are external
    "jsdoc/require-jsdoc": [
      "error",
      {
        "require": {
          "FunctionDeclaration": true,
          "MethodDefinition": true,
          "ClassDeclaration": true,
          "ArrowFunctionExpression": true,
          "FunctionExpression": true
        }
      }
    ],

    // CUI Standards - Code Complexity Rules
    "complexity": ["warn", 20], // Increased for test complexity
    "max-depth": ["warn", 5],   // Increased for nested describes/tests
    "max-lines-per-function": ["warn", 200], // Test functions can be large
    "max-params": ["error", 5],

    // CUI Standards - Naming Conventions
    "camelcase": ["error", {
      "allow": [
        "grant_type",        // OAuth2 standard field
        "client_id",         // OAuth2 standard field
        "client_secret",     // OAuth2 standard field
        "access_token",      // OAuth2 standard field
        "refresh_token",     // OAuth2 standard field
        "token_type",        // OAuth2 standard field
        "expires_in"         // OAuth2 standard field
      ]
    }],

    // CUI Standards - Security Rules
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",

    // CUI Standards - Code Quality from SonarJS
    "sonarjs/cognitive-complexity": ["warn", 25], // Increased for test complexity
    "sonarjs/no-duplicate-string": "off",          // Turn off - too noisy for tests with many selectors
    "sonarjs/no-identical-functions": "warn",      // Changed to warn for similar test patterns

    // CUI Standards - Additional Quality Rules
    "unicorn/filename-case": ["error", { "case": "kebabCase" }],
    "unicorn/no-null": "off", // Allow null for compatibility
  },

  // Playwright-specific overrides for test files
  overrides: [
    {
      files: ["tests/**/*.spec.js", "tests/**/*.test.js"],
      rules: {
        // Relax rules for Playwright test files
        "max-lines-per-function": "off", // Tests can have very large functions
        "complexity": "off",             // Tests can be complex
        "sonarjs/cognitive-complexity": "off", // Tests naturally complex
        "sonarjs/no-duplicate-string": "off",  // Allow duplicate strings in test files
        "jsdoc/require-jsdoc": "off",    // Don't require JSDoc for test functions
        "jsdoc/require-description": "off",
        "jsdoc/require-param-description": "off",
        "jsdoc/require-returns-description": "off",
        "jsdoc/require-example": "off",
        "jsdoc/no-undefined-types": "off",     // Allow undefined types in tests
        "no-unused-vars": "warn"         // Keep as warning for cleanup
      }
    },
    {
      files: ["utils/**/*.js"],
      rules: {
        // Relaxed rules for utility files
        "max-lines-per-function": ["warn", 150], // Utility functions can be larger
        "complexity": ["warn", 20],
        "sonarjs/cognitive-complexity": ["warn", 15],
        "jsdoc/require-jsdoc": "off",    // Don't require JSDoc for utility functions
        "jsdoc/require-description": "off",
        "jsdoc/require-param-description": "off",
        "jsdoc/require-returns-description": "off",
        "jsdoc/require-example": "off",
        "jsdoc/no-defaults": "off",      // Allow JSDoc parameter defaults
        "jsdoc/check-types": "off",      // Less strict type checking
        "jsdoc/no-undefined-types": "off", // Allow undefined types for Playwright
        "security/detect-object-injection": "off", // Utility functions often need dynamic property access
        "sonarjs/no-duplicate-string": "off"       // Allow duplicate strings in utility files
      }
    }
  ]
};
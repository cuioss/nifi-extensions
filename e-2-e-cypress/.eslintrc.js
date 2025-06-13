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
    "plugin:jsdoc/recommended",
    "plugin:prettier/recommended"
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  plugins: [
    "cypress", 
    "prettier", 
    "jsdoc", 
    "sonarjs", 
    "security",
    "unicorn"
  ],
  rules: {
    // CUI Standards - Code Quality Rules
    "prettier/prettier": "error",
    "no-console": "warn",
    "no-unused-vars": "warn",
    
    // CUI Standards - Cypress Rules
    "cypress/no-unnecessary-waiting": "warn",
    "cypress/unsafe-to-chain-command": "warn",
    "cypress/no-assigning-return-values": "error",
    
    // CUI Standards - JSDoc Documentation Requirements
    "jsdoc/require-description": "error",
    "jsdoc/require-param-description": "error", 
    "jsdoc/require-returns-description": "error",
    "jsdoc/require-example": "warn",
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
    
    // CUI Standards - Code Complexity Rules (Cypress-adapted)
    "complexity": ["warn", 20], // Increased for Cypress test complexity
    "max-depth": ["warn", 5],   // Increased for Cypress nested describes/its
    "max-lines-per-function": ["warn", 200], // Cypress test functions can be large
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
    
    // CUI Standards - Code Quality from SonarJS (Cypress-adapted)
    "sonarjs/cognitive-complexity": ["warn", 25], // Increased for Cypress test complexity
    "sonarjs/no-duplicate-string": "warn",
    "sonarjs/no-identical-functions": "warn", // Changed to warn for similar test patterns
    
    // CUI Standards - Additional Quality Rules
    "unicorn/filename-case": ["error", { "case": "kebabCase" }],
    "unicorn/no-null": "off", // Allow null for Cypress compatibility
    "prefer-const": "error",
    "no-var": "error"
  },
  
  // Cypress-specific overrides for test files
  overrides: [
    {
      files: ["cypress/e2e/**/*.cy.js", "cypress/integration/**/*.cy.js"],
      rules: {
        // Relax rules for Cypress test files
        "max-lines-per-function": "off", // Cypress tests can have very large functions
        "complexity": "off",             // Cypress tests can be complex
        "sonarjs/cognitive-complexity": "off", // Cypress tests naturally complex
        "jsdoc/require-jsdoc": "off",    // Don't require JSDoc for test functions
        "jsdoc/require-description": "off",
        "jsdoc/require-param-description": "off",
        "jsdoc/require-returns-description": "off",
        "jsdoc/require-example": "off",
        "no-unused-vars": "warn"         // Keep as warning for cleanup
      }
    },
    {
      files: ["cypress/support/**/*.js"],
      rules: {
        // Relaxed rules for support files (custom commands, etc.)
        "max-lines-per-function": ["warn", 100], // Support functions can be larger
        "complexity": ["warn", 15],
        "sonarjs/cognitive-complexity": ["warn", 15],
        "jsdoc/require-jsdoc": "off",    // Don't require JSDoc for Cypress commands
        "jsdoc/require-description": "off",
        "jsdoc/require-param-description": "off",
        "jsdoc/require-returns-description": "off",
        "jsdoc/require-example": "off"
      }
    }
  ]
};

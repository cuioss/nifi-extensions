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
    
    // CUI Standards - Code Complexity Rules
    "complexity": ["error", 10],
    "max-depth": ["error", 3],
    "max-lines-per-function": ["error", 50],
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
    "sonarjs/cognitive-complexity": ["error", 10],
    "sonarjs/no-duplicate-string": "warn",
    "sonarjs/no-identical-functions": "error",
    
    // CUI Standards - Additional Quality Rules
    "unicorn/filename-case": ["error", { "case": "kebabCase" }],
    "unicorn/no-null": "off", // Allow null for Cypress compatibility
    "prefer-const": "error",
    "no-var": "error"
  }
};

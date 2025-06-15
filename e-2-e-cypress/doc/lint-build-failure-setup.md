# Lint Build Failure Configuration

## Overview
This document describes the configuration changes made to ensure that the Maven build fails when ESLint warnings or errors are detected in the e-2-e-cypress module.

## Changes Made

### 1. Enhanced Package.json Scripts
Added a new `lint:strict` script that includes additional strictness:
```json
"lint:strict": "eslint 'cypress/**/*.js' --max-warnings 0 --report-unused-disable-directives"
```

This script:
- Sets maximum warnings to 0 (any warning fails the build)
- Reports unused ESLint disable directives
- Ensures strict adherence to linting rules

### 2. Maven Configuration Updates
Updated both the main build and the `local-integration-tests` profile to:
- Use the stricter `lint:strict` script instead of `lint:check`
- Run linting in the `validate` phase (earlier in the build lifecycle)
- Explicitly set `skip=false` to ensure linting always runs

### 3. Build Phases
- **Main Build**: Linting runs in the `validate` phase
- **Local Integration Tests Profile**: Linting runs in the `integration-test` phase

## Verification
The configuration has been tested to confirm:
1. ✅ Clean code passes the Maven build
2. ✅ Code with lint errors/warnings fails the Maven build
3. ✅ Unused ESLint disable directives are detected and cause build failure

## Current ESLint Configuration
The project uses a comprehensive ESLint configuration with:
- Strict code quality rules
- Security checking
- JSDoc documentation requirements
- Cypress-specific adaptations
- Different rule sets for test files vs. support files

## Usage
To run linting manually:
```bash
# Standard linting with warnings allowed
npm run lint

# Strict linting (used by Maven build)
npm run lint:strict

# Fix auto-fixable issues
npm run lint:fix
```

To trigger Maven build with linting:
```bash
# Main build
mvn validate

# Local integration tests
mvn integration-test -Dintegration.test.local
```

# NiFi Extensions - AI Agent Guide

This document provides practical information to help AI agents understand and work effectively with the NiFi Extensions codebase.

## Project Overview

**NiFi Extensions** is a CUI-OSS project that provides custom Apache NiFi processors for JWT token authentication and validation. The project implements a multi-issuer JWT token authenticator with a web-based UI for configuration.

- **Repository**: https://github.com/cuioss/nifi-extensions
- **License**: Apache 2.0
- **Java Version**: Java 21
- **Build System**: Maven (with Maven Wrapper)
- **Base NiFi Version**: 2.5.0

## Project Architecture

### Module Structure

The project is organized as a multi-module Maven build with the following modules:

1. **nifi-cuioss-processors** (JAR)
   - Core Java processors for JWT token authentication
   - Main processor: `MultiIssuerJWTTokenAuthenticator`
   - Supporting classes for configuration, validation, and utilities
   - Located at: `/nifi-cuioss-processors`
   - Key packages:
     - `de.cuioss.nifi.processors.auth` - Main processor classes
     - `de.cuioss.nifi.processors.auth.config` - Configuration management
     - `de.cuioss.nifi.processors.auth.util` - Utility classes
     - `de.cuioss.nifi.processors.auth.i18n` - Internationalization

2. **nifi-cuioss-ui** (WAR)
   - Web-based UI for processor configuration
   - Contains both Java servlets and JavaScript components
   - Build outputs as WAR file
   - Located at: `/nifi-cuioss-ui`
   - Key Java servlets:
     - `JwtVerificationServlet` - JWT token verification endpoint
     - `JwksValidationServlet` - JWKS validation endpoint
     - `MetricsServlet` - Metrics reporting
     - `ApiKeyAuthenticationFilter` - Authentication filter
   - JavaScript components in `src/main/webapp/js`:
     - `components/` - UI components
     - `services/` - Service modules
     - `utils/` - Utility functions

3. **nifi-cuioss-nar** (NAR)
   - NiFi Archive bundle containing processors and UI
   - Packages both processors and UI modules
   - Output format: .nar file for deployment in NiFi

4. **integration-testing** (JAR)
   - Docker-based integration testing setup
   - Contains Docker Compose configuration
   - Test environment with NiFi and Keycloak
   - Only for testing, excluded from releases

5. **e-2-e-playwright** (Node.js)
   - End-to-End testing framework using Playwright
   - WCAG 2.1 Level AA accessibility testing
   - Comprehensive test suites for processor functionality
   - Self-verification tests (24 tests)
   - Node.js-based, excluded from Sonar analysis

### Key Dependencies

**Java/Maven Dependencies**:
- `org.apache.nifi:nifi-api` (2.5.0) - NiFi core API
- `de.cuioss.sheriff.oauth:oauth-sheriff-core` (0.1.0) - OAuth token validation
- `de.cuioss:cui-java-tools` (2.6.1) - CUI utilities
- `org.projectlombok:lombok` (1.18.42) - Annotation processor
- `org.eclipse.parsson:parsson` (1.1.7) - Jakarta JSON implementation
- `org.yaml:snakeyaml` (2.5) - YAML parsing

**Testing Dependencies**:
- `org.junit.jupiter:junit-jupiter` (5.11.4) - JUnit 5
- `de.cuioss.test:cui-test-juli-logger` (2.0.1) - CUI logging test utilities
- `de.cuioss.test:cui-test-generator` (2.3.1) - Test data generation
- `de.cuioss.test:cui-test-value-objects` (2.0.1) - Value object testing

**Frontend Dependencies**:
- Node.js: v20.19.2
- NPM: 10.5.0
- Frontend Maven Plugin: 1.15.4
- ESLint: 8.57.0 / 8.57.1
- Prettier: 3.3.2 / 3.4.2
- Jest: 29.7.0
- Playwright: 1.42.1
- Vite: 5.4.0 (for UI bundling)

**WebJars Dependencies** (managed in pom.xml):
- jQuery: 3.7.1
- jQuery UI: 1.14.1
- RequireJS: 2.3.7
- cash-dom: 8.1.5
- Tippy.js: 6.3.7
- Popper.js: 2.11.8

## Build System & Technologies

### Maven Build

**Maven Wrapper**: Available via `./mvnw` (Unix-like systems) or `mvnw.cmd` (Windows)

**Key Build Commands**:
```bash
# Full build with all tests
./mvnw clean install

# Build specific module
./mvnw clean install -pl nifi-cuioss-ui

# Build without tests (faster)
./mvnw clean install -DskipTests

# Pre-commit code quality checks and modernization
./mvnw -Ppre-commit clean install -DskipTests

# Integration tests (requires Docker)
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true

# SonarQube analysis
./mvnw sonar:sonar -Psonar

# Maven POM cleanup
./mvnw -Prewrite-maven-clean rewrite:run
```

### Maven Profiles

1. **pre-commit** - Code modernization and formatting
   - OpenRewrite recipes for Java code formatting
   - License header additions
   - Import ordering and unused import removal
   - Java 21 migration recipes
   - Static analysis improvements
   - Usage: `./mvnw -Ppre-commit clean install -DskipTests`

2. **sonar** - SonarQube analysis
   - Excludes e-2-e-playwright module
   - Includes JaCoCo coverage reporting
   - Sends metrics to sonarcloud.io

3. **local-integration-tests** - Docker-based integration testing
   - Triggered by property: `-Dintegration.test.local=true`
   - Manages Docker Compose containers for NiFi and Keycloak
   - Coordinates container lifecycle (create, start, wait, stop)

4. **release** / **release-snapshot** - Release builds
   - Includes Javadoc generation
   - Source code packaging
   - GPG signing
   - Central repository publishing (Sonatype)

5. **rewrite-maven-clean** - POM file cleanup
   - Applies Maven best practices recipes

### Frontend Build

**JavaScript Build Tools**:
- **Vite** - Module bundler for nifi-cuioss-ui
- **Babel** - JavaScript transpilation (ES6+ to ES5)
- **ESLint** - Code quality and linting
- **Prettier** - Code formatting
- **Jest** - JavaScript unit testing
- **Playwright** - End-to-end testing

**Frontend Build Integration**:
- Maven Frontend Plugin orchestrates Node.js/NPM builds
- Integrates JavaScript compilation into Maven lifecycle
- Separate linting configurations for UI and E2E tests

## Testing Frameworks & Approaches

### Java Testing (JUnit 5)

**Framework**: JUnit 5 (Jupiter)
**Test Location**: `src/test/java`
**Coverage Requirement**: 80% minimum line coverage

**Test Utilities**:
- `cui-test-juli-logger` - Test logging support
- `cui-test-generator` - Test data generation (@GeneratorsSource)
- `cui-test-value-objects` - Value object contract testing
- `nifi-mock` - NiFi testing utilities

**Test Organization**:
- Follows AAA pattern (Arrange-Act-Assert)
- One logical assertion per test
- Independent tests, no execution order dependencies
- Use `@DisplayName` for test descriptions
- Use `@Nested` for test organization

**Running Java Tests**:
```bash
# All tests
./mvnw test

# Single test class
./mvnw test -Dtest=ClassName

# Single test method
./mvnw test -Dtest=ClassName#methodName

# With coverage
./mvnw test -Pcoverage
```

### JavaScript Testing (Jest)

**Framework**: Jest 29.7.0
**Test Location**: `nifi-cuioss-ui/src/test/js/**/*.test.js`
**Coverage Requirement**: 80% lines, 75% branches, 78% functions, 80% statements

**Test Configuration** (package.json Jest config):
```javascript
{
  "testEnvironment": "jest-environment-jsdom",
  "moduleDirectories": ["node_modules", "src/main/webapp/js"],
  "moduleNameMapper": {
    "^nf.Common$": "<rootDir>/src/test/js/mocks/nf-common.js",
    "^js/utils/formatters$": "<rootDir>/src/main/webapp/js/utils/formatters.js",
    // Additional module mappings for components and services
  },
  "setupFiles": ["<rootDir>/src/test/js/mocks/jquery-extended.js"],
  "setupFilesAfterEnv": ["<rootDir>/src/test/js/jest.setup-dom.js"]
}
```

**Testing Libraries**:
- `@testing-library/jest-dom` - DOM assertion helpers
- `jest-environment-jsdom` - Browser-like test environment
- Babel for ES6+ transpilation in tests

**Running JavaScript Tests**:
```bash
cd nifi-cuioss-ui
npm test                    # Run tests once
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
npm run test:ci            # CI mode (no watch)
```

### End-to-End Testing (Playwright)

**Framework**: Playwright 1.42.1
**Test Location**: `e-2-e-playwright/tests/**/*.spec.js`
**Scope**: Processor configuration, token validation, accessibility

**Test Categories**:
- `01-self-*.spec.js` - Self-verification tests (24 tests)
- `02-verify-jwt-authenticator-customizer.spec.js` - JWT authenticator tests
- `03-verify-jwks-validation-button.spec.js` - JWKS validation tests
- `accessibility-wcag-compliance.spec.js` - WCAG 2.1 Level AA compliance

**E2E Features**:
- Console error monitoring with allowlist
- Automated WCAG 2.1 Level AA compliance checks via axe-core
- Docker-based test environment
- Local integration testing with automated container management

**Running E2E Tests**:
```bash
cd e-2-e-playwright
npm run playwright:test              # Standard test run
npm run playwright:test:headed       # Headed (visible browser)
npm run playwright:test:ui           # Interactive UI mode
npm run test:a11y                   # Accessibility tests only
npm run test:jwt                    # JWT processor tests
npm run test:all                    # Full test suite
npm run playwright:report           # View HTML report
```

### Integration Testing

**Docker-Based Testing**:
- NiFi instance with custom processors deployed
- Keycloak for OAuth/OIDC testing
- Automated container lifecycle management
- Test data and configuration pre-loaded

**Running Integration Tests**:
```bash
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true

# Quick test run with existing containers
cd e-2-e-playwright && npm run playwright:test
```

## Code Standards & Style Guides

### Mandatory Standards Reference

All AI development must follow the standards defined in this agents.md file and the comprehensive CUI standards repository.

Key standards areas covered:
- Core process rules (mandatory)
- Task completion standards
- Code style guidelines
- Testing standards
- Logging standards
- Framework-specific standards
- AI tool instructions

### Java Code Standards

**Standards Base**: Java 21 LTS features

**Language Features**:
- Records for data carriers and DTOs
- Switch expressions (not classic switch)
- Text blocks for multi-line strings
- `var` for local variables with obvious types
- Sealed classes for restricted hierarchies
- Pattern matching in instanceof and switch
- Stream API for complex transformations
- Proper access modifiers (prefer package-private)
- Classes final by default unless designed for inheritance
- Composition over inheritance

**Code Organization**:
- Immutable objects when possible
- Fields final by default
- Enums instead of constants
- Immutable collections (List.of(), Set.of())
- No magic numbers, use named constants
- StringBuilder for string concatenation in loops
- Override toString() for debugging
- equals() and hashCode() together
- @Override annotation consistently

**Lombok Usage** (Annotation processor):
- `@Builder` for complex object creation
- `@Value` for immutable objects
- `@NonNull` for required parameters
- `@ToString` and `@EqualsAndHashCode` for value objects
- `@UtilityClass` for utility classes

**Logging**:
- Use `de.cuioss.tools.logging.CuiLogger`
- Private static final LOGGER (constant name 'LOGGER')
- Exception parameter always first
- Use '%s' for string substitutions (not '{}')
- Use `de.cuioss.tools.logging.LogRecord` for templates
- Log level ranges: INFO (001-99), WARN (100-199), ERROR (200-299), FATAL (300-399)
- All log messages documented in `doc/LogMessages.adoc`
- Forbidden: log4j, slf4j, System.out/err

### JavaScript Code Standards

**Standards Base**: ES6+, ESLint, Prettier

**ESLint Configuration** (`nifi-cuioss-ui/.eslintrc.cjs`):
- ECMAScript 2020+
- Browser, jQuery, AMD, Jest environments
- Airbnb-base config (via eslint-plugin-jest for tests)
- jQuery-specific rules configured
- 4-space indentation, single quotes, semicolons required
- Console methods allowed: debug, info, warn, error, table, time, timeEnd
- Max line length: 100 characters (warnings for comments/strings ignored)
- camelCase naming with exceptions for `jwks_type`

**ESLint Configuration** (`e-2-e-playwright/.eslintrc.js`):
- ES2022+
- Stricter rules for test files
- JSDoc required for all functions (except test files)
- Code complexity limits (with test-specific relaxations)
- Security plugins enabled (sonarjs, security)
- Unicorn plugin for code quality
- OAuth2 field name exceptions: grant_type, client_id, etc.

**Code Style Rules**:
- 4-space indentation (UI), 2-space acceptable in E2E
- Single quotes for strings
- Semicolons required
- No trailing commas in arrays/objects
- Arrow spacing and keyword spacing enforced
- Object/array bracket spacing rules
- Max line length: 100 characters (UI), no hard limit for tests
- No console.log (only structured logging methods)
- Prefer const over let, never use var
- Proper error handling and async/await patterns

**Prettier Configuration**:
- Automatic code formatting (integrated with ESLint)
- 2 or 4-space indentation depending on context
- Single quotes, semicolons
- Ensures consistent formatting across team

### Documentation Standards

**Format**: AsciiDoc (.adoc files)
**Location**: `doc/` directory

**Standards Compliance**:
- Document header with TOC and section numbering
- Use `:source-highlighter: highlight.js`
- Use `xref:` syntax for cross-references (not `<<>>`)
- Blank lines required before lists
- Consistent heading hierarchy
- Update main README when adding documents

**Required Documentation**:
- `doc/Requirements.adoc` - Project requirements
- `doc/Specification.adoc` - Implementation specification
- `doc/LogMessages.adoc` - All log message definitions
- `README.adoc` - Project overview (root level)

### Naming Conventions

**Java**:
- Classes: PascalCase, final unless designed for inheritance
- Methods: camelCase
- Constants: UPPERCASE_WITH_UNDERSCORES
- Packages: lowercase, organization-based (de.cuioss.nifi.*)
- Test classes: ClassName + "Test"

**JavaScript**:
- Files: kebab-case (e.g., `token-verifier.js`)
- Functions: camelCase
- Classes/Components: PascalCase
- Constants: UPPERCASE_WITH_UNDERSCORES
- Private methods/properties: leading underscore (convention)

## Development Workflow

### Pre-Commit Checklist (Mandatory)

Execute in order before ANY commit:

1. **Quality Verification**:
   ```bash
   ./mvnw -Ppre-commit clean install -DskipTests
   ```
   - Fixes code formatting and imports
   - Applies modernization recipes
   - Check console output and fix ALL errors/warnings

2. **Full Build & Tests**:
   ```bash
   ./mvnw clean install
   ```
   - Must complete without errors or warnings
   - All tests must pass
   - Tasks complete ONLY after this succeeds

3. **Integration Tests** (optional but recommended):
   ```bash
   ./mvnw clean verify -pl e-2-e-playwright -Pintegration-tests
   ```
   - Ensure UI integration tests pass
   - Verify end-to-end scenarios

4. **Documentation**:
   - Update if changes affect APIs, features, or configuration

5. **Commit Message**:
   - Follow conventional commit format (see PR Instructions section)

### Code Quality Gates

**Zero-Warning Policy**: The project maintains zero-warning builds through strategic implementation of standards.

**Sonar Quality Gates**:
- Coverage thresholds enforced
- Code smell limits
- Security hotspot review
- SonarCloud integration (sonarcloud.io)
- E2E tests excluded from analysis

## Common Development Tasks

### Adding a New Java Class

1. Create class in appropriate package under `de.cuioss.nifi.*`
2. Add Javadoc comments:
   - Class-level documentation with purpose
   - All public methods documented
   - Parameters, return values, exceptions documented
   - `@since` tag with version
3. Follow Java standards (immutable, final, no nulls)
4. Add unit tests in `src/test/java` with 80%+ coverage
5. Run `./mvnw -Ppre-commit clean install -DskipTests`
6. Fix all formatting issues
7. Run `./mvnw clean install` to verify

### Adding JavaScript Component

1. Create component file in `nifi-cuioss-ui/src/main/webapp/js/components/`
2. Use ES6+ features and modular exports
3. Add JSDoc comments for all public methods
4. Add unit tests in `nifi-cuioss-ui/src/test/js/`
5. Run `cd nifi-cuioss-ui && npm run lint:fix`
6. Run `npm run test:coverage` - ensure 80%+ coverage
7. Verify no ESLint errors: `npm run lint`

### Adding E2E Test

1. Create test file in `e-2-e-playwright/tests/`
2. Follow Playwright patterns and CUI standards
3. Use descriptive test names with `test.describe()`
4. Add JSDoc for test suites
5. Run `npm run lint:fix` for formatting
6. Run `npm run playwright:test` locally
7. Check accessibility if UI changes: `npm run test:a11y`

### Debugging

**Java Debugging**:
- Use IDE debugger (IntelliJ recommended)
- Debug tests directly with Maven: `./mvnw -Dtest=ClassName#methodName debug`

**JavaScript Debugging**:
- Jest watch mode: `npm run test:watch`
- Playwright headed mode: `npm run playwright:test:headed`
- Playwright UI mode: `npm run playwright:test:ui`
- Browser DevTools in headed tests

**Docker/Integration Testing**:
```bash
# View logs
docker compose logs -f nifi keycloak

# Access NiFi UI
https://localhost:9095/nifi/

# Access Keycloak admin
http://localhost:8080/auth/
```

## Commonly Modified Files

**Core Processor Logic**:
- `nifi-cuioss-processors/src/main/java/de/cuioss/nifi/processors/auth/MultiIssuerJWTTokenAuthenticator.java`
- `nifi-cuioss-processors/src/main/java/de/cuioss/nifi/processors/auth/config/ConfigurationManager.java`

**UI Configuration**:
- `nifi-cuioss-ui/src/main/java/de/cuioss/nifi/ui/servlets/JwtVerificationServlet.java`
- `nifi-cuioss-ui/src/main/webapp/js/components/issuerConfigEditor.js`
- `nifi-cuioss-ui/src/main/webapp/js/components/tokenVerifier.js`

**Tests**:
- `nifi-cuioss-processors/src/test/java/de/cuioss/nifi/processors/auth/`
- `nifi-cuioss-ui/src/test/js/`
- `e-2-e-playwright/tests/`

**Build & Configuration**:
- `pom.xml` - Maven parent configuration
- `.eslintrc.cjs` - JavaScript linting (UI)
- `.eslintrc.js` - JavaScript linting (E2E)
- `package.json` - NPM scripts and dependencies

## Important Notes for AI Agents

### Git & GitHub Integration

- Use `gh` command-line tool for GitHub operations (not GitHub MCP)
- Always check git status before making changes
- Link commits to issues when relevant
- Follow standardized commit message format

### Testing Philosophy

- All new code requires appropriate test coverage
- Existing tests must continue to pass
- Critical paths require 100% coverage
- Use CUI test generators for complex test data
- Parameterized tests mandatory for 3+ similar variants

### Forbidden Practices

**Java**:
- Mockito, PowerMock, Hamcrest (use CUI alternatives)
- log4j, slf4j, System.out/err (use CUI logger)
- Null returns (use Optional or empty collections)

**JavaScript**:
- console.log (use structured logging methods)
- var keyword (use let/const)
- Unformatted code (run prettier)

**General**:
- Committing without running pre-commit checks
- Adding dependencies without approval
- Disabling security or code quality checks
- Hardcoding credentials or secrets

### Standards Hierarchy (Critical Decision Framework)

When conflicting information exists, follow this priority:

1. **Core Process Rules** (CRITICAL - highest priority, non-negotiable)
2. **Project-Specific Context** (agents.md, CLAUDE.md, local config)
3. **Standards References** (CUI standards repository, adaptable based on context)
4. **General Guidelines** (lowest priority, may be overridden)

### When in Doubt

- Always ask the user rather than guessing
- Research topics using available tools
- Never be creative with standards or architecture
- Refer to CUI standards repository when unsure

## Quick Reference: Key Commands

```bash
# Build & Test
./mvnw clean install                    # Full build
./mvnw clean install -DskipTests        # Build without tests
./mvnw -Ppre-commit clean install -DskipTests  # Pre-commit checks
./mvnw test                             # Run tests
./mvnw clean verify -Psonar             # SonarQube analysis

# Frontend (from nifi-cuioss-ui)
npm run lint                            # ESLint check
npm run lint:fix                        # ESLint fix
npm test                                # Jest tests
npm run test:coverage                   # Coverage report
npm run build                           # Production build
npm run dev                             # Watch mode

# E2E Tests (from e-2-e-playwright)
npm run playwright:test                 # Run all tests
npm run playwright:test:headed          # Visible browser
npm run playwright:test:ui              # Interactive mode
npm run test:a11y                      # Accessibility tests

# Integration Testing
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true

# Docker Container Management
docker compose up -d                    # Start containers
docker compose down                     # Stop containers
docker compose logs -f                  # View logs
```

## Project Health Indicators

- **Build Status**: GitHub Actions (maven.yml, e2e-tests.yml)
- **Code Quality**: SonarCloud analysis
- **Coverage**: JaCoCo for Java, Jest for JavaScript
- **Dependencies**: Regular updates via Dependabot
- **Security**: Scanned via SonarQube security rules and OWASP checks

## Additional Resources

- **Main README**: `/README.adoc` - Project overview
- **Requirements**: `/doc/Requirements.adoc` - Project requirements
- **Specification**: `/doc/Specification.adoc` - Implementation details
- **Log Messages**: `/doc/LogMessages.adoc` - All logging definitions
- **Build Guide**: `/doc/Build.adoc` - Detailed build instructions
- **E2E Testing**: `/e-2-e-playwright/README.adoc` - E2E test documentation
- **Accessibility Guide**: `/e-2-e-playwright/docs/accessibility-testing-guide.adoc`
- **Standards Repository**: https://github.com/cuioss/cui-llm-rules/

---

**Last Updated**: October 2025
**For Additional Questions**: Refer to this agents.md file first, then ask the project owner if needed.

# NiFi Extensions — Deep Reference

This document supplements `CLAUDE.md` with detailed architecture, how-to tasks, and debugging guidance. It is **not** auto-loaded — consult it when you need step-by-step instructions or deeper context.

## Module Architecture

### nifi-cuioss-api (JAR)
- Controller Service API interfaces (packaged as separate NAR for NiFi 2.x classloader separation)
- Key packages:
  - `de.cuioss.nifi.jwt.config` — JwtIssuerConfigService (CS interface), JwtAuthenticationConfig (config record)

### nifi-cuioss-api-nar (NAR)
- Packages the API module into a separate `.nar` archive (required by NiFi 2.x classloader separation)

### nifi-cuioss-common (JAR)
- Shared JWT infrastructure: Controller Service implementation, configuration, utilities
- Key packages:
  - `de.cuioss.nifi.jwt` — JWTAttributes, JwtConstants, JWTPropertyKeys, JWTTranslationKeys
  - `de.cuioss.nifi.jwt.config` — StandardJwtIssuerConfigService, ConfigurationManager, IssuerConfigurationParser
  - `de.cuioss.nifi.jwt.util` — AuthorizationValidator, AuthorizationRequirements, TokenClaimMapper, ProcessingError, ErrorContext
  - `de.cuioss.nifi.jwt.i18n` — I18nResolver, NiFiI18nResolver

### nifi-cuioss-processors (JAR)
- Main processor: `MultiIssuerJWTTokenAuthenticator`
- Key packages:
  - `de.cuioss.nifi.processors.auth` — Main processor class, AuthLogMessages, JWTProcessorConstants

### nifi-cuioss-rest-processors (JAR)
- REST API gateway processor: `RestApiGatewayProcessor`
- Key packages:
  - `de.cuioss.nifi.rest` — RestApiGatewayProcessor, RestApiGatewayConstants, RestApiAttributes
  - `de.cuioss.nifi.rest.handler` — GatewayRequestHandler, ManagementEndpointHandler, ProblemDetail, GatewaySecurityEvents, HttpRequestContainer, SanitizedRequest
  - `de.cuioss.nifi.rest.config` — RouteConfiguration, RouteConfigurationParser

### nifi-cuioss-ui (WAR)
- Java servlets: `JwtVerificationServlet`, `JwksValidationServlet`, `MetricsServlet`, `ProcessorIdValidationFilter`, `ComponentInfoServlet`, `GatewayProxyServlet`
- JavaScript modules in `src/main/webapp/js/` — `app.js`, `api.js`, `issuer-config.js`, `token-verifier.js`, `metrics.js`, `rest-endpoint-config.js`, `endpoint-tester.js`, `utils.js`

### nifi-cuioss-nar (NAR)
- Packages processors + UI into a single `.nar` archive for NiFi deployment

### integration-testing (JAR)
- Docker Compose setup with NiFi and Keycloak
- Only for testing, excluded from releases

### e-2-e-playwright (Node.js)
- Playwright E2E tests + WCAG 2.1 Level AA accessibility testing via axe-core
- Excluded from Sonar analysis

## Maven Profiles

| Profile | Purpose | Usage |
|---------|---------|-------|
| `pre-commit` | OpenRewrite code formatting, imports, license headers, Java 21 migration | `./mvnw -Ppre-commit clean install -DskipTests` |
| `sonar` | SonarQube analysis with JaCoCo coverage | `./mvnw clean verify -Psonar` |
| `integration-tests` | Docker-based integration testing (Java ITs + Playwright E2E) | `./mvnw verify -Pintegration-tests` |
| `release` / `release-snapshot` | Release builds (Javadoc, sources, GPG, Sonatype) | CI-managed |
| `rewrite-maven-clean` | POM file cleanup | `./mvnw -Prewrite-maven-clean rewrite:run` |

## Java Testing Details

**Test utilities**: cui-test-juli-logger (logging), cui-test-generator (@GeneratorsSource), cui-test-value-objects (contract testing), nifi-mock (NiFi test harness)

**Running tests**:
```bash
./mvnw test                              # All tests
./mvnw test -Dtest=ClassName             # Single class
./mvnw test -Dtest=ClassName#methodName  # Single method
```

**Logging standards**:
- Private static final `LOGGER` using `CuiLogger`
- Exception parameter always first
- `%s` for substitutions (not `{}`)
- Log level ranges: INFO (001-99), WARN (100-199), ERROR (200-299), FATAL (300-399)
- All messages documented in `doc/LogMessages.adoc`

## JavaScript Testing Details

**Test location**: `nifi-cuioss-ui/src/test/js/**/*.test.js`

**Running tests**:
```bash
cd nifi-cuioss-ui
npm test                    # Run tests once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

**E2E tests**:
```bash
cd e-2-e-playwright
npm run playwright:test              # Standard run
npm run playwright:test:headed       # Visible browser
npm run playwright:test:ui           # Interactive UI mode
npm run test:a11y                    # Accessibility tests only
npm run playwright:report            # View HTML report
```

## Common Development Tasks

### Adding a New Java Class

1. Create class in appropriate package under `de.cuioss.nifi.*`
2. Add Javadoc (class-level, public methods, `@since` tag)
3. Follow standards: immutable, final, no nulls
4. Add unit tests in `src/test/java` with 80%+ coverage
5. Run `./mvnw -Ppre-commit clean install -DskipTests` — fix all issues
6. Run `./mvnw clean install` — verify build passes

### Adding a JavaScript Component

1. Create file in `nifi-cuioss-ui/src/main/webapp/js/components/`
2. Use ES6+ features, add JSDoc for public methods
3. Add unit tests in `nifi-cuioss-ui/src/test/js/`
4. Run `npm run lint:fix` then `npm run test:coverage` (80%+ coverage)

### Adding an E2E Test

1. Create test file in `e-2-e-playwright/tests/`
2. Use `test.describe()` with descriptive names and JSDoc
3. Run `npm run lint:fix` then `npm run playwright:test`
4. Check accessibility if UI changes: `npm run test:a11y`

## Debugging

**Java**: IDE debugger (IntelliJ recommended), or `./mvnw -Dtest=ClassName#methodName debug`

**JavaScript**: `npm run test:watch` (Jest), `npm run playwright:test:headed` or `npm run playwright:test:ui` (Playwright)

**Docker/Integration**:
```bash
docker compose logs -f nifi keycloak    # View logs
# NiFi UI: https://localhost:9095/nifi/
# Keycloak: http://localhost:8080/auth/
```

## Commonly Modified Files

**Core processor logic**:
- `nifi-cuioss-processors/src/main/java/de/cuioss/nifi/processors/auth/MultiIssuerJWTTokenAuthenticator.java`
- `nifi-cuioss-rest-processors/src/main/java/de/cuioss/nifi/rest/RestApiGatewayProcessor.java`
- `nifi-cuioss-rest-processors/src/main/java/de/cuioss/nifi/rest/handler/GatewayRequestHandler.java`
- `nifi-cuioss-common/src/main/java/de/cuioss/nifi/jwt/config/StandardJwtIssuerConfigService.java`
- `nifi-cuioss-common/src/main/java/de/cuioss/nifi/jwt/config/ConfigurationManager.java`

**UI configuration**:
- `nifi-cuioss-ui/src/main/java/de/cuioss/nifi/ui/servlets/JwtVerificationServlet.java`
- `nifi-cuioss-ui/src/main/webapp/js/issuer-config.js`
- `nifi-cuioss-ui/src/main/webapp/js/token-verifier.js`

**Tests**:
- `nifi-cuioss-processors/src/test/java/de/cuioss/nifi/processors/auth/`
- `nifi-cuioss-rest-processors/src/test/java/de/cuioss/nifi/rest/`
- `nifi-cuioss-common/src/test/java/de/cuioss/nifi/jwt/`
- `nifi-cuioss-ui/src/test/js/`
- `e-2-e-playwright/tests/`

**Build & config**:
- `pom.xml` (Maven parent), `.eslintrc.cjs` (UI linting), `.eslintrc.js` (E2E linting), `package.json` (NPM)

## Documentation

- **Format**: AsciiDoc (.adoc), located in `doc/`
- **Key files**: `Requirements.adoc`, `Specification.adoc`, `LogMessages.adoc`, `README.adoc`
- **Standards**: Use `xref:` for cross-references, blank lines before lists, consistent heading hierarchy

## Additional Resources

- `/README.adoc` — Project overview
- `/doc/Build.adoc` — Build instructions
- `/e-2-e-playwright/README.adoc` — E2E test documentation
- `/e-2-e-playwright/docs/accessibility-testing-guide.adoc` — Accessibility guide
- https://github.com/cuioss/cui-llm-rules/ — CUI standards repository

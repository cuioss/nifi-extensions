# Claude Code Configuration — NiFi Extensions

## Project

Custom Apache NiFi processors for JWT authentication and validation with a web-based configuration UI.

### Modules
- **nifi-cuioss-processors** (JAR) — Core JWT authentication processors
- **nifi-cuioss-ui** (WAR) — Web UI for processor configuration (Java servlets + JavaScript)
- **nifi-cuioss-nar** (NAR) — NiFi Archive bundle for deployment
- **integration-testing** (JAR) — Docker-based integration tests (NiFi + Keycloak)
- **e-2-e-playwright** (Node.js) — Playwright E2E and WCAG accessibility tests

## Build Commands

**Never hard-code build tool commands** (`./mvnw`, `npm run`, …). Invoke builds via the canonical plan-marshall executor commands below so module/profile resolution stays correct. Always use a 10-minute Bash timeout (`600000` ms) for build commands, and analyze each build's TOON result (`status`, `errors[N]{file,line,message,category}`, `log_file`) rather than scanning raw stdout.

- **Compile:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "compile"`
- **Quality gate:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify -Psonar"`
- **Full verify:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify"`
- **Integration tests:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify -Pintegration-tests -pl integration-testing -am"` — runbook (container lifecycle, mandatory `-pl integration-testing -am`, concurrency rule) lives in the `/deploy it` skill mode
- **Coverage:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify -Pcoverage"`
- **Module tests (e-2-e-playwright-npm):** `python3 .plan/execute-script.py plan-marshall:build-npm:npm run --command-args "run test --prefix=e-2-e-playwright"` — only on e-2-e-playwright-npm
- **Module tests (nifi-cuioss-ui-npm):** `python3 .plan/execute-script.py plan-marshall:build-npm:npm run --command-args "run test --prefix=nifi-cuioss-ui"` — only on nifi-cuioss-ui-npm

## Docker E2E Deployment

Use `/deploy` skill for full runbook. Quick reference:

- **First start:** `./integration-testing/src/main/docker/run-and-deploy.sh`
- **Redeploy after code changes:** `./integration-testing/src/main/docker/redeploy-nifi.sh`
- **Stop containers:** `cd integration-testing/src/main/docker && docker compose down -v`
- **Run E2E tests (containers running):** `cd e-2-e-playwright && npm run playwright:test`

### Running Maven integration tests (`-Pintegration-tests`)

To run the integration-testing module's Java Failsafe ITs, use the `/deploy it` skill mode — the runbook (self-managed container lifecycle, mandatory `-pl integration-testing -am`, and the concurrency rule) lives there.

## Conventions

The detailed language/testing standards live in plan-marshall skills — load them on demand instead of duplicating here. Each bullet names the skill that owns the standard (Java 21 features, Lombok, CuiLogger, JUnit/AAA/coverage, CUI test libraries, JS modules/lint, Jest):

- **Java core** (Java 21 records, switch expressions, text blocks, pattern matching, sealed classes) — `pm-dev-java:java-core`
- **Lombok** (@Builder, @Value, @NonNull, @UtilityClass) — `pm-dev-java:java-lombok`
- **Null safety** (no null returns — use Optional or empty collections) — `pm-dev-java:java-null-safety`
- **CUI logging** (CuiLogger, `LOGGER` constant, `%s` substitutions, LogRecord; no log4j/slf4j/System.out) — `pm-dev-java-cui:cui-logging`
- **JUnit / coverage** (AAA pattern, `@DisplayName`, `@Nested`, parameterized for 3+ variants, 80% Java line coverage) — `pm-dev-java:junit-core`
- **CUI test libraries** (cui-test-generator, cui-test-value-objects, cui-test-juli-logger; no Mockito/PowerMock) — `pm-dev-java-cui:cui-testing`
- **JavaScript core** (ES modules, `const` over `let`, no `var`) — `pm-dev-frontend:javascript`
- **JS lint/format** (ESLint + Prettier) — `pm-dev-frontend:lint-config`
- **JS unit tests** (Jest; 80% lines, 75% branches, 78% functions) — `pm-dev-frontend:jest-testing`

Project-specific conventions (not covered by the skills above):

- **AsciiDoc** (.adoc) for documentation

## Forbidden Practices

Language-level prohibitions are owned by the skills referenced under [Conventions](#conventions) (no Mockito/PowerMock → `pm-dev-java-cui:cui-testing`; no log4j/slf4j/System.out → `pm-dev-java-cui:cui-logging`; no `var` → `pm-dev-frontend:javascript`; no null returns → `pm-dev-java:java-null-safety`). Project-specific prohibitions:

- **No direct Hamcrest** — OK as REST Assured transitive dependency; do not use standalone
- **No raw `console.log`** in JavaScript — use the `log` utility from `utils.js` (`log.info`, `log.warn`, `log.error`, `log.debug`)
- **No commits without pre-commit checks** — always run the pre-commit profile then a clean install via the [Build Commands](#build-commands) executor: `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "-Ppre-commit clean install -DskipTests"` then `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "clean install"`
- **No hardcoded credentials or secrets**

## Temporary Files

- Use `.plan/temp/` for ALL temporary files (covered by `Write(.plan/**)` permission - avoids permission prompts)

## Deep Reference

See `doc/` for detailed architecture, configuration reference, guides, and step-by-step instructions. Key entry points: `doc/README.adoc` (documentation index), `doc/architecture/README.adoc` (module overview), `doc/reference/configuration.adoc` (all properties).

## Tool Usage

- Use proper tools (Edit, Read, Write) instead of shell commands (echo, cat)
- Never use Bash for file operations (find, grep, cat, ls) — use Glob, Read, Grep tools instead

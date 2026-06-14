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
- **Integration tests:** `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify -Pintegration-tests -pl integration-testing -am"` — stop any running Docker containers first; see [Running Maven integration tests](#running-maven-integration-tests--pintegration-tests)
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

The Maven `integration-tests` profile **manages its own container lifecycle** (`deploy-and-start.sh` starts NiFi+Keycloak and waits for readiness; `cleanup-containers` stops them afterward). Because it binds the same host ports the standalone dev stack uses (Keycloak `9085`/`9086`, NiFi `9095`), any already-running containers cause a port conflict and the IT run fails. Follow this pre-flight every time:

1. **Check for running containers:** `docker ps`
2. **If the integration-testing stack is up** (compose project `docker`, e.g. `docker-keycloak-1` / `docker-nifi-1`), stop it:
   `docker compose -f integration-testing/src/main/docker/docker-compose.yml down -v`
   (Unnamed containers without a `keycloak`/`nifi` compose label do not bind the IT ports and can be left running.)
3. **Run the IT** via the canonical executor with `-pl integration-testing -am` (the `-am` is mandatory — `integration-testing` test sources depend on the `nifi-cuioss-common` test-jar, which is only built when the reactor is also-made):
   `python3 .plan/execute-script.py plan-marshall:build-maven:maven run --command-args "verify -Pintegration-tests -pl integration-testing -am"`

The profile tears its own containers down on completion. Do NOT run `/deploy` and a Maven IT run at the same time.

## Conventions

- **Java 21** — Records, switch expressions, text blocks, pattern matching, sealed classes
- **Lombok** — @Builder, @Value, @NonNull, @UtilityClass
- **CuiLogger** — `de.cuioss.tools.logging.CuiLogger`, constant name `LOGGER`, `%s` substitutions, LogRecord for templates
- **JUnit 5** with CUI test utilities (cui-test-generator, cui-test-value-objects, cui-test-juli-logger)
- **AAA test pattern**, `@DisplayName`, `@Nested`, parameterized tests for 3+ similar variants
- **80% coverage minimum** (Java line coverage; JS: 80% lines, 75% branches, 78% functions)
- **ESLint + Prettier** for JavaScript, `const` over `let`
- **AsciiDoc** (.adoc) for documentation

## Forbidden Practices

- **No Mockito, PowerMock** — use CUI test alternatives
- **No direct Hamcrest** — OK as REST Assured transitive dependency; do not use standalone
- **No log4j, slf4j, System.out/err** in Java — use CuiLogger
- **No `var`** keyword in JavaScript — use `const`/`let`
- **No raw `console.log`** in JavaScript — use the `log` utility from `utils.js` (`log.info`, `log.warn`, `log.error`, `log.debug`)
- **No commits without pre-commit checks** — always run `./mvnw -Ppre-commit clean install -DskipTests` then `./mvnw clean install`
- **No hardcoded credentials or secrets**
- **No null returns** in Java — use Optional or empty collections

## Git Workflow

All cuioss repositories have branch protection on `main`. Direct pushes to `main` are never allowed. Always use this workflow:

1. Create a feature branch: `git checkout -b <branch-name>`
2. Commit changes: `git add <files> && git commit -m "<message>"`
3. Push the branch: `git push -u origin <branch-name>`
4. Create a PR: `gh pr create --repo cuioss/nifi-extensions --head <branch-name> --base main --title "<title>" --body "<body>"`
5. Wait for CI + Gemini review (waits until checks complete): `gh pr checks --watch`
6. **Handle Gemini review comments** — fetch with `gh api repos/cuioss/nifi-extensions/pulls/<pr-number>/comments` and for each:
   - If clearly valid and fixable: fix it, commit, push, then reply explaining the fix and resolve the comment
   - If disagree or out of scope: reply explaining why, then resolve the comment
   - If uncertain (not 100% confident): **ask the user** before acting
   - Every comment MUST get a reply (reason for fix or reason for not fixing) and MUST be resolved
7. Do **NOT** enable auto-merge unless explicitly instructed. Wait for user approval.
8. Return to main: `git checkout main && git pull`

## Temporary Files

- Use `.plan/temp/` for ALL temporary files (covered by `Write(.plan/**)` permission - avoids permission prompts)

## Deep Reference

See `doc/` for detailed architecture, configuration reference, guides, and step-by-step instructions. Key entry points: `doc/README.adoc` (documentation index), `doc/architecture/README.adoc` (module overview), `doc/reference/configuration.adoc` (all properties).

## Tool Usage

- Use proper tools (Edit, Read, Write) instead of shell commands (echo, cat)
- Never use Bash for file operations (find, grep, cat, ls) — use Glob, Read, Grep tools instead

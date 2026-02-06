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

```bash
./mvnw clean install                                    # Full build + tests
./mvnw -Ppre-commit clean install -DskipTests           # Pre-commit quality checks (MANDATORY before commits)
./mvnw clean verify -Psonar                             # SonarQube analysis
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true  # Integration tests

# Frontend (from nifi-cuioss-ui/)
npm test                                                # Jest tests
npm run lint                                            # ESLint check

# E2E (from e-2-e-playwright/)
npm run playwright:test                                 # Playwright tests
```

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

- **No Mockito, PowerMock, Hamcrest** — use CUI test alternatives
- **No log4j, slf4j, System.out/err** — use CuiLogger
- **No `var`** keyword in JavaScript — use `const`/`let`
- **No console.log** — use structured logging
- **No commits without pre-commit checks** — always run `./mvnw -Ppre-commit clean install -DskipTests` then `./mvnw clean install`
- **No hardcoded credentials or secrets**
- **No null returns** in Java — use Optional or empty collections

## Git Workflow

All cuioss repositories have branch protection on `main`. Direct pushes to `main` are never allowed. Always use this workflow:

1. Create a feature branch: `git checkout -b <branch-name>`
2. Commit changes: `git add <files> && git commit -m "<message>"`
3. Push the branch: `git push -u origin <branch-name>`
4. Create a PR: `gh pr create --repo cuioss/nifi-extensions --head <branch-name> --base main --title "<title>" --body "<body>"`
5. Wait for CI + Gemini review (check every ~60s until checks complete): `while ! gh pr checks --repo cuioss/nifi-extensions <pr-number> --watch; do sleep 60; done`
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

See `agents.md` for detailed architecture, Maven profiles, step-by-step tasks (adding classes/components/tests), debugging instructions, and commonly modified files.

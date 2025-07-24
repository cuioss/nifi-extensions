# AI Development Guidelines

This file provides guidance to AI tools when working with code in this repository.

## Guidelines Location

All AI development guidelines are located in: **`doc/ai-rules.md`**

Please refer to that file for:
- Core process rules
- Task completion standards
- Code style guidelines
- Testing standards
- Logging standards
- Framework-specific standards
- AI tool specific instructions

## Project-Specific Build Commands

- Build project: `./mvnw clean install`
- Build Single Module: `./mvnw clean install -pl nifi-cuioss-ui`
- Run tests: `./mvnw test`
- Run single test: `./mvnw test -Dtest=ClassName#methodName`
- Clean-Up Code: `./mvnw -Ppre-commit clean install -DskipTests` -> Check the console after running the command and fix all errors and warnings, verify until they are all corrected
 - Integration-tests: `./mvnw clean verify -pl e-2-e-playwright -Pintegration-tests`: Runs the ui integration-tests
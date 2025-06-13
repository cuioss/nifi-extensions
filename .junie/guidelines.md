# JUNIE.md

This file provides guidance to Junie when working with code in this repository.

## Build Commands
- Build project: `./mvnw clean install`
- Run tests: `./mvnw test`
- Run single test: `./mvnw test -Dtest=ClassName#methodName`
- Create site: `./mvnw site`
- Clean-Up Javadoc: `./mvnw clean install -Pjavadoc` -> Check the console after running the command and fix all errors and warnings, verify until they are all corrected
- Clean-Up Code: Use `./mvnw -Prewrite rewrite:run` -> verify with `./mvnw clean install` -> Fix if necessary and commit

## Project Documentation
- Requirements: `doc/Requirements.adoc`
- Specification: `doc/Specification.adoc`
- Technical components: `doc/specification/technical-components.adoc`
- Security specification: `doc/specification/security.adoc`
- Testing guidelines: `doc/specification/testing.adoc`
- Configuration: `doc/specification/configuration.adoc`
- Error handling: `doc/specification/error-handling.adoc`
- Integration patterns: `doc/specification/integration-patterns.adoc`
- Internationalization: `doc/specification/internationalization.adoc`
- Token validation: `doc/specification/token-validation.adoc`
- Log messages: `doc/LogMessage.md`

## CUI Standards Documentation
- Standards Overview: `/Users/oliver/git/cui-llm-rules/standards/README.md`

### JavaScript and CSS Standards:
- JavaScript Standards: `/Users/oliver/git/cui-llm-rules/standards/javascript/`
- CSS Standards: `/Users/oliver/git/cui-llm-rules/standards/css/`

### Java Standards
- Java Code Standards: `/Users/oliver/git/cui-llm-rules/standards/java/java-code-standards.adoc`
- DSL-Style Constants: `/Users/oliver/git/cui-llm-rules/standards/java/dsl-style-constants.adoc`
- Java README: `/Users/oliver/git/cui-llm-rules/standards/java/README.adoc`

### Documentation Standards
- General Documentation: `/Users/oliver/git/cui-llm-rules/standards/documentation/general-standard.adoc`
- Javadoc Standards: `/Users/oliver/git/cui-llm-rules/standards/documentation/javadoc-standards.adoc`
- Javadoc Maintenance: `/Users/oliver/git/cui-llm-rules/standards/documentation/javadoc-maintenance.adoc`
- README Structure: `/Users/oliver/git/cui-llm-rules/standards/documentation/readme-structure.adoc`
- Documentation README: `/Users/oliver/git/cui-llm-rules/standards/documentation/README.adoc`

### Logging Standards
- Logging Core Standards: `/Users/oliver/git/cui-llm-rules/standards/logging/core-standards.adoc`
- Logging Implementation Guide: `/Users/oliver/git/cui-llm-rules/standards/logging/implementation-guide.adoc`
- Logging Testing Guide: `/Users/oliver/git/cui-llm-rules/standards/logging/testing-guide.adoc`
- Logging README: `/Users/oliver/git/cui-llm-rules/standards/logging/README.adoc`

### Testing Standards
- Testing Core Standards: `/Users/oliver/git/cui-llm-rules/standards/testing/core-standards.adoc`
- Quality Standards: `/Users/oliver/git/cui-llm-rules/standards/testing/quality-standards.adoc`
- Testing README: `/Users/oliver/git/cui-llm-rules/standards/testing/README.adoc`

### Requirements Standards
- Requirements Documents: `/Users/oliver/git/cui-llm-rules/standards/requirements/requirements-document.adoc`
- Specification Documents: `/Users/oliver/git/cui-llm-rules/standards/requirements/specification-documents.adoc`
- New Project Guide: `/Users/oliver/git/cui-llm-rules/standards/requirements/new-project-guide.adoc`
- Planning: `/Users/oliver/git/cui-llm-rules/standards/requirements/planning.adoc`
- Requirements README: `/Users/oliver/git/cui-llm-rules/standards/requirements/README.adoc`

## Code Style Guidelines
- Follow package structure: reverse domain name notation (de.cuioss.jwt.validation)
- Use DSL-style nested constants for logging messages in JWTTokenLogMessages
- Organize imports: Java standard first, then 3rd party, then project imports
- Use `@NonNull` annotations from Lombok for required parameters
- Keep classes small and focused - follow Single Responsibility Principle
- Follow builder pattern for complex object creation
- Use meaningful, descriptive method and variable names
- Use Optional for nullable return values instead of null
- Use immutable objects when possible
- Always validate input parameters
- Prefer delegation over inheritance

## Lombok Usage
- Use `@Builder` for complex object creation
- Use `@Value` for immutable objects
- Use `@NonNull` for required parameters
- Use `@ToString` and `@EqualsAndHashCode` for value objects
- Use `@UtilityClass` for utility classes
- Make proper use of `lombok.config` settings

## Logging Standards
- Use `de.cuioss.tools.logging.CuiLogger` (private static final LOGGER)
- Use LogRecord API for structured logging with dedicated message constants
- Follow logging level ranges: INFO (001-99), WARN (100-199), ERROR (200-299), FATAL (300-399)
- Use CuiLogger.error(exception, ERROR.CONSTANT.format(param)) pattern
- All log messages must be documented in doc/LogMessage.md
- Exception parameter always comes first in logging methods
- Use '%s' for string substitutions (not '{}')

## Testing Standards
- Use JUnit 5 (`@Test`, `@DisplayName`, `@Nested`)
- Use cui-test-juli-logger for logger testing with `@EnableTestLogger`
- Test all code paths, edge cases, and error conditions
- Use assertLogMessagePresentContaining for testing log messages
- Follow Arrange-Act-Assert pattern in test methods
- Tests must be independent and not rely on execution order
- Unit tests should use descriptive method names
- Use nested test classes to organize related tests
- Mock or stub dependencies in unit tests
- Use test data builders when appropriate
- All public methods must have unit tests
- Test coverage should aim for at least 80% line coverage

## Javadoc Standards
- Every public class/interface must be documented
- Include clear purpose statement in class documentation
- Document all public methods with parameters, returns, and exceptions
- Include `@since` tag with version information
- Document thread-safety considerations
- Include usage examples for complex classes and methods
- Every package should have package-info.java
- Use `{@link}` for references to classes, methods, and fields
- Document Builder classes with complete usage examples

= MultiIssuerJWTTokenAuthenticator TODO List
:toc:
:toclevels: 3
:toc-title: Table of Contents
:sectnums:

== Overview

This document lists the actionable tasks required to fully implement the MultiIssuerJWTTokenAuthenticator according to the requirements and specifications. All tasks are traceable to requirements/specifications and use standard status indicators.

== Implementation Tasks

=== Core Components

==== MultiIssuerJWTTokenAuthenticator Processor
_See Requirements NIFI-AUTH-2, NIFI-AUTH-3, NIFI-AUTH-4 in link:Requirements.adoc[Requirements]_

* [ ] Implement processor class and relationships
* [ ] Integrate cui-jwt-validation for token validation ([Specification](Specification.adoc), [Token Validation](specification/token-validation.adoc))
* [ ] Support multiple issuers and dynamic issuer configuration
* [ ] Implement property descriptors and dynamic properties ([Configuration](specification/configuration.adoc))
* [ ] Implement output attributes for success/failure ([Requirements NIFI-AUTH-6](Requirements.adoc))
* [ ] Implement error handling and standardized error codes ([Requirements NIFI-AUTH-10](Requirements.adoc), [Error Handling](specification/error-handling.adoc))

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

==== Configuration Support
_See Requirements NIFI-AUTH-7.1, NIFI-AUTH-7.7 in link:Requirements.adoc[Requirements]_

* [ ] Implement UI configuration ([UI Configuration](specification/configuration-ui.adoc))
* [ ] Implement static configuration file support ([Static Configuration](specification/configuration-static.adoc))
* [ ] Implement environment variable support
* [ ] Ensure configuration precedence and reload

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

==== Security & Performance
_See Requirements NIFI-AUTH-8, NIFI-AUTH-9 in link:Requirements.adoc[Requirements]_

* [ ] Enforce secure algorithms, key management, and HTTPS ([Security](specification/security.adoc))
* [ ] Implement caching, memory, and performance limits
* [ ] Integrate security event monitoring ([Observability](specification/observability.adoc))

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

==== Internationalization (i18n)
_See Requirements NIFI-AUTH-17 in link:Requirements.adoc[Requirements]_

* [ ] Internationalize all user-facing strings ([Internationalization](specification/internationalization.adoc))
* [ ] Provide resource bundles for English and German
* [ ] Internationalize error messages and UI components

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

== Testing
_See link:specification/testing.adoc[Testing Specification]_

=== Unit Testing
_See Requirements NIFI-AUTH-14_

* [ ] Implement unit tests for all core logic
* [ ] Achieve required test coverage

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

=== Integration Testing
_See Requirements NIFI-AUTH-15_

* [ ] Implement integration tests with Keycloak ([cui-test-keycloak-integration](library/cui-test-keycloak-integration/README.adoc))
* [ ] Implement mock JWKS endpoint tests ([cui-test-mockwebserver-junit5](library/cui-test-mockwebserver-junit5/README.adoc))

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

=== JavaScript/UI Testing
_See Requirements NIFI-AUTH-16.4_

* [ ] Implement JavaScript/UI tests ([JavaScript Testing](specification/javascript-testing.adoc))

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

== Documentation
_See Requirements NIFI-AUTH-13_

* [ ] Maintain and update all AsciiDoc documentation ([Specification](Specification.adoc))
* [ ] Update PlantUML diagrams as needed ([Build.adoc](Build.adoc))
* [ ] Ensure all cross-references and See Also sections are present and correct

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

== Observability & Metrics
_See Requirements NIFI-AUTH-18 in link:Requirements.adoc[Requirements]_

* [ ] Expose processor metrics in NiFi UI ([Observability](specification/observability.adoc))
* [ ] Integrate with NiFi metrics system
* [ ] Expose Prometheus-compatible metrics

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

== Security
_See Requirements NIFI-AUTH-8_

* [ ] Implement input validation and authentication checks
* [ ] Ensure no sensitive information is logged

_Postconditions for each step:_
* Verify with a Maven build: `./mvnw -Prewrite rewrite:run clean install javadoc:javadoc` (fix all Javadoc errors/warnings, all tests must pass)
* GIT commit each verified step

== Task Status Indicators

* `[ ]` - Task not started or in progress
* `[x]` - Task completed
* `[~]` - Task partially completed
* `[!]` - Task blocked or has issues

== Relationship to Other Documentation

This plan references:

* link:Requirements.adoc[Requirements]
* link:Specification.adoc[Specification]
* link:specification/technical-components.adoc[Technical Components]
* link:specification/testing.adoc[Testing]
* link:specification/security.adoc[Security]
* link:specification/configuration.adoc[Configuration]
* link:specification/internationalization.adoc[Internationalization]
* link:specification/observability.adoc[Observability]
* link:../.junie/guidelines.md[Project Guidelines]

== Implementation Notes

* _Note: If any requirement or specification is unclear or incomplete, update the corresponding section in Specification.adoc or the relevant specification file before implementation._
* _Document any assumptions or clarifications in the code and documentation._

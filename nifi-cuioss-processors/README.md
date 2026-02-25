# nifi-cuioss-processors

`MultiIssuerJWTTokenAuthenticator` processor for Apache NiFi.

## Purpose

This module contains the `MultiIssuerJWTTokenAuthenticator` NiFi processor, which validates JWT tokens from FlowFile attributes against multiple identity providers. It extracts the JWT from a configurable FlowFile attribute, validates it via the shared `JwtIssuerConfigService` Controller Service, and routes FlowFiles to `success` or `authentication-failed` relationships.

## Key Classes

| Class | Description |
|---|---|
| `MultiIssuerJWTTokenAuthenticator` | Main NiFi processor extending `AbstractProcessor`. Reads JWT from FlowFile attributes, validates via CS, writes token claims as output attributes. |
| `JWTProcessorConstants` | Property descriptors (token attribute name, require valid token, required roles/scopes, CS reference) and relationship definitions. |
| `AuthLogMessages` | Standardized log messages with `AUTH` prefix for token validation events. |

## Module Relationships

- **References**: `JwtIssuerConfigService` from `nifi-cuioss-api`
- **Uses**: `AuthorizationValidator`, `ErrorContext` from `nifi-cuioss-common`
- **Packaged in**: `nifi-cuioss-nar` (the main deployable NAR)

## Building

This module is built as part of the parent project:

```bash
./mvnw clean install
```

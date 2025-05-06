# Log Messages for MultiIssuerJWTTokenAuthenticator

_See Requirement [NIFI-AUTH-10: Error Handling Requirements](Requirements.adoc#NIFI-AUTH-10)_

This document defines the standardized log messages for the MultiIssuerJWTTokenAuthenticator processor in NiFi 2.3.0.
The processor integrates with the cui-jwt-validation library and follows a consistent logging format.

All messages follow the format: [AUTH]-[identifier]: [message]

## INFO Level (001-099)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-001 | Processor | Successfully validated token from issuer '%s' | Logged when a JWT token is successfully validated |
| AUTH-002 | Processor | Successfully refreshed JWKS from endpoint '%s' | Logged when JWKS keys are successfully refreshed from an endpoint |
| AUTH-003 | Processor | Successfully initialized with %d issuers | Logged when the processor is successfully initialized with issuers |
| AUTH-004 | Processor | Successfully verified token from issuer '%s' via verification UI | Logged when a token is successfully verified through the verification UI |
| AUTH-005 | Processor | Token verification UI accessed | Logged when the token verification UI is accessed |

## WARN Level (100-199)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-100 | Processor | Using expired JWKS from endpoint '%s' because refresh failed | Logged when falling back to an expired JWKS because refresh failed |
| AUTH-101 | Processor | No token found in header '%s' | Logged when no token is found in the specified header |
| AUTH-102 | Processor | Token contains insufficient privileges. Required: %s, Found: %s | Logged when a token has insufficient privileges |
| AUTH-103 | Processor | Token verification failed: %s | Logged when token verification through the UI fails with the reason |
| AUTH-104 | Processor | Token verification attempted with invalid configuration | Logged when token verification is attempted with invalid processor configuration |

## ERROR Level (200-299)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-200 | Processor | Invalid token format: %s | Logged when a token has an invalid format |
| AUTH-201 | Processor | Invalid token signature for issuer '%s' | Logged when a token has an invalid signature |
| AUTH-202 | Processor | Token has expired | Logged when a token has expired |
| AUTH-203 | Processor | Token not yet valid | Logged when a token is not yet valid (nbf claim) |
| AUTH-204 | Processor | Unknown token issuer: %s | Logged when a token has an unknown issuer |
| AUTH-205 | Processor | Token audience does not match required audience | Logged when a token's audience doesn't match the required audience |
| AUTH-206 | Processor | Token missing required scopes: %s | Logged when a token is missing required scopes |
| AUTH-207 | Processor | Token missing required roles: %s | Logged when a token is missing required roles |
| AUTH-208 | Processor | Failed to retrieve JWKS from endpoint '%s': %s | Logged when JWKS retrieval fails |
| AUTH-209 | Processor | Invalid processor configuration: %s | Logged when the processor has an invalid configuration |
| AUTH-210 | Processor | Failed to connect to JWKS endpoint '%s': %s | Logged when connection to a JWKS endpoint fails |
| AUTH-211 | Processor | Failed to parse JWKS response from endpoint '%s': %s | Logged when parsing a JWKS response fails |
| AUTH-212 | Processor | Failed to initialize token factory: %s | Logged when initialization of the token factory fails |
| AUTH-213 | Processor | Error in token verification endpoint: %s | Logged when an error occurs in the token verification endpoint |
| AUTH-214 | Processor | JWT claim validation failed: %s | Logged when token claim validation fails |
| AUTH-215 | Processor | JWT key resolution failed: %s | Logged when token key resolution fails |
| AUTH-216 | Processor | Integration error with cui-jwt-validation: %s | Logged when there's an integration error with the validation library |

## FATAL Level (300-399)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-300 | Processor | Critical security failure: %s | Logged when a critical security failure occurs |
| AUTH-301 | Processor | Fatal error during processor initialization: %s | Logged when a fatal error occurs during processor initialization |

## DEBUG Level (500-599)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-500 | Processor | Processing token with key ID: %s | Logged when processing a token with a specific key ID |
| AUTH-501 | Processor | Token claims: %s | Logged when examining token claims |
| AUTH-502 | Processor | JWKS refresh triggered for endpoint: %s | Logged when a JWKS refresh is triggered |
| AUTH-503 | Processor | Token validation started for issuer: %s | Logged when token validation starts |
| AUTH-504 | Processor | Signature verification started with algorithm: %s | Logged when signature verification starts |
| AUTH-505 | Processor | Authorization check started with scopes: %s | Logged when authorization check starts |
| AUTH-506 | Processor | cui-jwt-validation library initialized with version: %s | Logged when the validation library is initialized |

## TRACE Level (600-699)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| AUTH-600 | Processor | Raw token header: %s | Logged when examining raw token header |
| AUTH-601 | Processor | Raw token payload: %s | Logged when examining raw token payload |
| AUTH-602 | Processor | JWKS response content: %s | Logged when examining JWKS response content |
| AUTH-603 | Processor | HTTP request details: %s | Logged when examining HTTP request details |
| AUTH-604 | Processor | HTTP response details: %s | Logged when examining HTTP response details |
| AUTH-605 | Processor | Key matching details: %s | Logged when examining key matching details |
| AUTH-606 | Processor | cui-jwt-validation detailed log: %s | Logged when capturing detailed logs from the validation library |

## Java Implementation

The log messages are implemented using the LogRecord pattern:

```java
import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;
import lombok.experimental.UtilityClass;

/**
 * Provides logging messages for the JWT authentication processor.
 * All messages follow the format: AUTH-[identifier]: [message]
 */
@UtilityClass
public final class AuthLogMessages {

    private static final String PREFIX = "AUTH";

    @UtilityClass
    public static final class INFO {
        public static final LogRecord TOKEN_VALIDATED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("Successfully validated token from issuer '%s'")
                .build();

        // Additional INFO log records
    }

    @UtilityClass
    public static final class WARN {
        public static final LogRecord USING_EXPIRED_JWKS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("Using expired JWKS from endpoint '%s' because refresh failed")
                .build();
                
        // Additional WARN log records
    }

    @UtilityClass
    public static final class ERROR {
        public static final LogRecord INVALID_TOKEN_FORMAT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(200)
                .template("Invalid token format: %s")
                .build();
                
        // Additional ERROR log records
    }
}
```

## Log Message Use within Processor

Log messages are used throughout the processor code:

```java
// INFO level
LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATED.format(issuer));

// WARN level
LOGGER.warn(AuthLogMessages.WARN.TOKEN_MISSING.format(tokenHeader));

// ERROR level
LOGGER.error(AuthLogMessages.ERROR.INVALID_TOKEN_FORMAT.format(errorMessage));

// ERROR level with exception
LOGGER.error(e, AuthLogMessages.ERROR.JWKS_RETRIEVAL_FAILED.format(jwksUrl, e.getMessage()));

# Log Messages for MultiIssuerJWTTokenAuthenticator

_See Requirement [NIFI-AUTH-10: Error Handling Requirements](Requirements.adoc#NIFI-AUTH-10)_

All messages follow the format: [JWTAuth]-[identifier]: [message]

## INFO Level (001-099)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-001 | Processor | Successfully validated token from issuer '%s' | Logged when a JWT token is successfully validated |
| JWTAuth-002 | Processor | Successfully retrieved JWKS from endpoint '%s' | Logged when JWKS keys are successfully retrieved from an endpoint |
| JWTAuth-003 | Processor | Successfully initialized with %d issuers | Logged when the processor is successfully initialized with issuers |
| JWTAuth-004 | Processor | Successfully verified token from issuer '%s' via verification UI | Logged when a token is successfully verified through the verification UI |
| JWTAuth-005 | Processor | Token verification UI accessed | Logged when the token verification UI is accessed |

## WARN Level (100-199)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-100 | Processor | Using expired JWKS from endpoint '%s' because refresh failed | Logged when falling back to an expired JWKS because refresh failed |
| JWTAuth-101 | Processor | No token found in header '%s' | Logged when no token is found in the specified header |
| JWTAuth-102 | Processor | Token contains insufficient privileges. Required: %s, Found: %s | Logged when a token has insufficient privileges |
| JWTAuth-103 | Processor | Token verification failed: %s | Logged when token verification through the UI fails with the reason |
| JWTAuth-104 | Processor | Token verification attempted with invalid configuration | Logged when token verification is attempted with invalid processor configuration |

## ERROR Level (200-299)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-200 | Processor | Failed to connect to JWKS endpoint '%s': %s | Logged when connection to a JWKS endpoint fails |
| JWTAuth-201 | Processor | Failed to parse JWKS response from endpoint '%s': %s | Logged when parsing a JWKS response fails |
| JWTAuth-202 | Processor | Failed to initialize token factory: %s | Logged when initialization of the token factory fails |
| JWTAuth-203 | Processor | Error in token verification endpoint: %s | Logged when an error occurs in the token verification endpoint |
| JWTAuth-204 | Processor | Invalid token format: %s | Logged when a token has an invalid format |
| JWTAuth-205 | Processor | Invalid token signature for issuer '%s' | Logged when a token has an invalid signature |
| JWTAuth-206 | Processor | Token has expired | Logged when a token has expired |
| JWTAuth-207 | Processor | Token not yet valid | Logged when a token is not yet valid (nbf claim) |
| JWTAuth-208 | Processor | Unknown token issuer: %s | Logged when a token has an unknown issuer |
| JWTAuth-209 | Processor | Token audience does not match required audience | Logged when a token's audience doesn't match the required audience |
| JWTAuth-210 | Processor | Token missing required scopes: %s | Logged when a token is missing required scopes |
| JWTAuth-211 | Processor | Token missing required roles: %s | Logged when a token is missing required roles |
| JWTAuth-212 | Processor | Failed to retrieve JWKS from endpoint '%s': %s | Logged when JWKS retrieval fails |
| JWTAuth-213 | Processor | Invalid processor configuration: %s | Logged when the processor has an invalid configuration |

## FATAL Level (300-399)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-300 | Processor | Critical security failure: %s | Logged when a critical security failure occurs |
| JWTAuth-301 | Processor | Fatal error during processor initialization: %s | Logged when a fatal error occurs during processor initialization |

## DEBUG Level (500-599)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-500 | Processor | Processing token with key ID: %s | Logged when processing a token with a specific key ID |
| JWTAuth-501 | Processor | Token claims: %s | Logged when examining token claims |
| JWTAuth-502 | Processor | JWKS refresh triggered for endpoint: %s | Logged when a JWKS refresh is triggered |
| JWTAuth-503 | Processor | Token validation started for issuer: %s | Logged when token validation starts |
| JWTAuth-504 | Processor | Signature verification started with algorithm: %s | Logged when signature verification starts |
| JWTAuth-505 | Processor | Authorization check started with scopes: %s | Logged when authorization check starts |

## TRACE Level (600-699)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-600 | Processor | Raw token header: %s | Logged when examining raw token header |
| JWTAuth-601 | Processor | Raw token payload: %s | Logged when examining raw token payload |
| JWTAuth-602 | Processor | JWKS response content: %s | Logged when examining JWKS response content |
| JWTAuth-603 | Processor | HTTP request details: %s | Logged when examining HTTP request details |
| JWTAuth-604 | Processor | HTTP response details: %s | Logged when examining HTTP response details |
| JWTAuth-605 | Processor | Key matching details: %s | Logged when examining key matching details |

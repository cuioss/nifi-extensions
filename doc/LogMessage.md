# Log Messages for MultiIssuerJWTTokenAuthenticator

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
| JWTAuth-100 | Processor | Token validation failed: %s | Logged when token validation fails with the reason |
| JWTAuth-101 | Processor | JWKS endpoint '%s' returned invalid response: %s | Logged when a JWKS endpoint returns an invalid response |
| JWTAuth-102 | Processor | Token contains insufficient privileges. Required: %s, Found: %s | Logged when a token has insufficient privileges |
| JWTAuth-103 | Processor | Token verification failed: %s | Logged when token verification through the UI fails with the reason |
| JWTAuth-104 | Processor | Token verification attempted with invalid configuration | Logged when token verification is attempted with invalid processor configuration |

## ERROR Level (200-299)

| ID | Component | Message | Description |
|----|-----------|---------|-------------|
| JWTAuth-200 | Processor | Failed to connect to JWKS endpoint '%s': %s | Logged when connection to a JWKS endpoint fails |
| JWTAuth-201 | Processor | Failed to parse JWKS response from endpoint '%s': %s | Logged when parsing a JWKS response fails |
| JWTAuth-202 | Processor | Failed to initialize token factory: %s | Logged when initialization of the token factory fails |
| JWTAuth-203 | Processor | Error in token verification endpoint: %s | Logged when an error occurs in the token verification REST endpoint |
| JWTAuth-204 | Processor | Failed to process token verification request: %s | Logged when processing a token verification request fails |

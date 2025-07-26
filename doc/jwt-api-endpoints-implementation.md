# JWT API Endpoints Implementation Guide

## Overview

The NiFi JWT Authenticator UI expects certain REST endpoints for token verification functionality. Since NiFi processors cannot directly expose REST endpoints, this guide explains how to properly implement these endpoints in production.

## Expected Endpoints

### 1. Token Verification Endpoint
- **Path**: `/api/token/verify`
- **Method**: POST
- **Purpose**: Verify JWT tokens and return validation results

#### Request Format
```json
{
  "token": "eyJ...",
  "issuer": "https://example.com",  // optional
  "requiredScopes": ["read", "write"],  // optional
  "requiredRoles": ["admin"]  // optional
}
```

#### Response Format (Success - 200)
```json
{
  "valid": true,
  "issuer": "https://example.com",
  "claims": {
    "sub": "user123",
    "iss": "https://example.com",
    "exp": 1234567890,
    "scopes": ["read", "write"],
    "roles": ["admin"]
  },
  "authorized": true,  // if scopes/roles were checked
  "scopes": ["read", "write"],
  "roles": ["admin"]
}
```

#### Response Format (Invalid Token - 400)
```json
{
  "valid": false,
  "error": "Invalid token format - token is malformed"
}
```

#### Response Format (Expired Token - 401)
```json
{
  "valid": false,
  "error": "Token has expired",
  "expiredAt": 1234567890000
}
```

## Implementation Options

### Option 1: HandleHTTPRequest/HandleHTTPResponse Processors (Recommended)

Create a NiFi flow that implements the REST endpoints:

1. **HandleHTTPRequest Processor**
   - Listening Port: 9096 (or any available port)
   - Allowed Paths: `/api/token/verify`
   - HTTP Method: POST

2. **RouteOnAttribute Processor**
   - Route based on the requested path

3. **ExecuteScript Processor**
   - Implement token verification logic
   - Access the MultiIssuerJWTTokenAuthenticator's configuration
   - Verify tokens using the same JWKS/issuers

4. **HandleHTTPResponse Processor**
   - Return JSON responses with appropriate status codes

#### Example NiFi Flow
```
[HandleHTTPRequest] --> [RouteOnAttribute] --> [ExecuteScript] --> [HandleHTTPResponse]
                                            |
                                            --> [LogAttribute] (for errors)
```

### Option 2: Separate Microservice

Deploy a lightweight service alongside NiFi:

```javascript
// Example using Node.js/Express
const express = require('express');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
app.use(express.json());

// Configure JWKS clients for each issuer
const issuers = {
  'issuer1': jwksClient({
    jwksUri: 'https://issuer1.com/.well-known/jwks.json'
  }),
  // ... more issuers
};

app.post('/api/token/verify', async (req, res) => {
  const { token, issuer, requiredScopes, requiredRoles } = req.body;
  
  try {
    // Verify token logic here
    // Use the same JWKS/issuer configuration as NiFi
    
    res.json({
      valid: true,
      claims: decodedToken,
      // ... other fields
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error.message
    });
  }
});

app.listen(9096);
```

### Option 3: Reverse Proxy Configuration

Use nginx or Apache to route requests:

```nginx
location /api/token/verify {
    proxy_pass http://localhost:9096;  # Your verification service
}

location / {
    proxy_pass https://localhost:9095;  # NiFi
}
```

## Security Considerations

1. **Authentication**: Ensure the API endpoints require authentication
2. **CORS**: Configure appropriate CORS headers for the UI domain
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **HTTPS**: Always use HTTPS in production
5. **Input Validation**: Validate all inputs to prevent injection attacks

## Integration with NiFi Processor

The REST endpoints should:
1. Read the same issuer configuration as the MultiIssuerJWTTokenAuthenticator
2. Use the same JWKS endpoints or files
3. Apply the same validation rules
4. Return consistent results with the processor's validation

## Testing

The E2E tests in `e-2-e-playwright/tests/07-verify-token-verification-api.spec.js` define the expected behavior. These tests will:
- Skip if endpoints aren't available
- Verify all response formats when endpoints exist
- Test error handling and edge cases

## Monitoring

Consider implementing:
- Request/response logging
- Metrics collection (success/failure rates)
- Health check endpoints
- Performance monitoring

## Example HandleHTTPRequest Flow Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<template encoding-version="1.3">
  <description>JWT Token Verification API</description>
  <name>JWT-Token-Verification-API</name>
  <snippet>
    <!-- NiFi flow XML would go here -->
    <!-- This would include the processors configured for token verification -->
  </snippet>
</template>
```

## Conclusion

While NiFi processors cannot directly expose REST endpoints, the recommended approach is to use HandleHTTPRequest/HandleHTTPResponse processors to create the necessary API endpoints. This keeps the solution within NiFi's architecture while providing the functionality needed by the custom UI.
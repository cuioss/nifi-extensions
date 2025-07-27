# JWT API Endpoints Implementation Guide

## Implementation Status (Updated: 2025-01-27)

### ✅ Completed Backend Tasks
- [x] Create servlet module structure in `nifi-cuioss-ui/src/main/java/de/cuioss/nifi/ui/`
- [x] Create `IssuerConfigurationParser` in `nifi-cuioss-processors` for shared configuration parsing
- [x] Update `MultiIssuerJWTTokenAuthenticator` to use `IssuerConfigurationParser`
- [x] Add cui-jwt-validation and Jakarta JSON dependencies to `nifi-cuioss-ui/pom.xml`
- [x] Implement `JwtVerificationServlet` for token verification
- [x] Implement `JwksValidationServlet` for JWKS URL validation
- [x] Implement `MetricsServlet` for security metrics
- [x] Create `JwtValidationService` with TokenValidator logic
- [x] Create `ProcessorConfigReader` utility to fetch processor configuration
- [x] Implement `ApiKeyAuthenticationFilter` for secure access
- [x] Update `web.xml` with servlet mappings

### ❌ Pending Frontend Integration Tasks
- [ ] Modify processor to generate and pass API key to UI
- [ ] Update UI JavaScript to use API key authentication
- [ ] Connect UI components to REST endpoints
- [ ] Write unit tests using RestAssured
- [ ] Update E2E test `07-verify-token-verification-api.spec.js`
- [ ] Test integration with actual NiFi instance

### 🔴 Critical Issue
**E2E tests are failing** because they expect UI components (tabs for Token Verification, JWKS Validation, Metrics, Help) to be displayed in the processor configuration dialog. The current implementation only provides REST API endpoints without the frontend UI integration.

## Overview

This guide implements REST endpoints for JWT token verification in the NiFi JWT Authenticator UI using servlet implementation in the existing WAR module.

## Important Architecture Note

**Note on Jakarta EE 10**: NiFi 2.4.0 uses Jakarta EE 10. All servlet imports must use `jakarta.servlet.*` instead of `javax.servlet.*` packages.

### Configuration Access Strategy

The servlets need to access the processor's configuration to create the same TokenValidator instance. There are two approaches:

1. **REST API Approach** (shown in implementation): Servlets call NiFi's REST API to fetch processor configuration
   - Pros: Clean separation, works with NiFi's security model
   - Cons: Requires HTTP calls, potential latency

2. **Shared State Approach** (alternative): Processor stores TokenValidator in a shared registry
   - Pros: Direct access, better performance
   - Cons: More complex lifecycle management

The implementation uses the REST API approach as it's more aligned with NiFi's architecture.

## Expected Endpoints

### 1. Token Verification Endpoint
- **Path**: `/nifi-api/processors/jwt/verify-token`
- **Method**: POST
- **Purpose**: Verify JWT tokens using the cui-jwt-validation library

#### Request Format
```json
{
  "token": "eyJ...",
  "processorId": "uuid-of-processor",
  "issuer": "https://example.com",
  "requiredScopes": ["read", "write"],
  "requiredRoles": ["admin"]
}
```

**Field Descriptions:**
- `token` (required): The JWT token to verify
- `processorId` (required): UUID of the MultiIssuerJWTTokenAuthenticator processor to use for configuration
- `issuer` (optional): Expected issuer claim, if provided will be validated
- `requiredScopes` (optional): Array of required scopes for authorization check
- `requiredRoles` (optional): Array of required roles for authorization check

### 2. JWKS URL Validation
- **Path**: `/nifi-api/processors/jwt/validate-jwks-url`
- **Method**: POST
- **Purpose**: Validate JWKS URL accessibility

#### Request Format
```json
{
  "jwksUrl": "https://example.com/.well-known/jwks.json",
  "processorId": "uuid-of-processor"
}
```

#### Response Format
```json
{
  "valid": true,
  "accessible": true,
  "error": "",
  "keyCount": 2,
  "algorithms": ["RS256", "ES256"]
}
```

### 3. JWKS File Validation
- **Path**: `/nifi-api/processors/jwt/validate-jwks-file`
- **Method**: POST
- **Purpose**: Validate JWKS file content

#### Request Format
```json
{
  "jwksFilePath": "/path/to/jwks.json",
  "processorId": "uuid-of-processor"
}
```

### 4. JWKS Content Validation
- **Path**: `/nifi-api/processors/jwt/validate-jwks-content`
- **Method**: POST
- **Purpose**: Validate inline JWKS content

#### Request Format
```json
{
  "jwksContent": "{\"keys\":[...]}",
  "processorId": "uuid-of-processor"
}
```

### 5. Security Metrics
- **Path**: `/nifi-api/processors/jwt/metrics`
- **Method**: GET
- **Purpose**: Get security metrics

#### Response Format
```json
{
  "totalTokensValidated": 1250,
  "validTokens": 1180,
  "invalidTokens": 70,
  "errorRate": 0.056,
  "lastValidation": "2025-01-27T10:30:00Z",
  "topErrors": [
    {"error": "Token expired", "count": 45},
    {"error": "Invalid signature", "count": 25}
  ]
}
```

## Implementation Steps

### Step 1: Create Servlet Module Structure
```
nifi-cuioss-ui/
├── src/main/java/de/cuioss/nifi/ui/
│   ├── servlets/
│   │   ├── JwtVerificationServlet.java
│   │   ├── JwksValidationServlet.java
│   │   └── MetricsServlet.java
│   ├── service/
│   │   └── JwtValidationService.java
│   └── util/
│       └── ProcessorConfigReader.java
```

### Step 2: Create Servlet Classes

#### JwtVerificationServlet
```java
package de.cuioss.nifi.ui.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import jakarta.json.Json;
import jakarta.json.JsonException;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.json.JsonReaderFactory;
import jakarta.json.JsonWriterFactory;
import java.io.IOException;
import java.util.Map;

@WebServlet("/nifi-api/processors/jwt/verify-token")
public class JwtVerificationServlet extends HttpServlet {
    
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) 
            throws ServletException, IOException {
        
        // 1. Parse JSON request body using Jakarta JSON API
        JsonObject requestJson;
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            requestJson = reader.readObject();
        } catch (JsonException e) {
            resp.setStatus(400);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Invalid JSON format\",\"valid\":false}");
            }
            return;
        }
        
        // 2. Validate required fields
        if (!requestJson.containsKey("token") || !requestJson.containsKey("processorId")) {
            resp.setStatus(400);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Missing required fields: token and processorId\",\"valid\":false}");
            }
            return;
        }
        
        String token = requestJson.getString("token");
        String processorId = requestJson.getString("processorId");
        
        // 3. Verify token using service
        JwtValidationService service = new JwtValidationService();
        TokenValidationResult result;
        try {
            result = service.verifyToken(token, processorId);
        } catch (IllegalArgumentException e) {
            resp.setStatus(400);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Invalid request: " + e.getMessage() + "\",\"valid\":false}");
            }
            return;
        } catch (IllegalStateException e) {
            resp.setStatus(500);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Service not available: " + e.getMessage() + "\",\"valid\":false}");
            }
            return;
        } catch (IOException e) {
            resp.setStatus(500);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Communication error: " + e.getMessage() + "\",\"valid\":false}");
            }
            return;
        }
        
        // 3. Build JSON response using Jakarta JSON API
        JsonObject responseJson = Json.createObjectBuilder()
            .add("valid", result.isValid())
            .add("error", result.getError() != null ? result.getError() : "")
            .add("claims", result.getClaims() != null ? 
                 convertClaimsToJson(result.getClaims()) : Json.createObjectBuilder())
            .build();
        
        // 4. Write response
        resp.setContentType("application/json");
        resp.setStatus(result.isValid() ? 200 : 400);
        
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
        } catch (IOException e) {
            // Handle JSON writing errors
            resp.setStatus(500);
            resp.setContentType("application/json");
            try (var errorWriter = resp.getWriter()) {
                errorWriter.write("{\"error\":\"Internal server error\",\"valid\":false}");
            } catch (IOException writeError) {
                // Log error if needed
                throw new ServletException("Failed to write error response", writeError);
            }
        }
    }
}
```

#### JwksValidationServlet
```java
package de.cuioss.nifi.ui.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import jakarta.json.Json;
import jakarta.json.JsonException;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.json.JsonReaderFactory;
import jakarta.json.JsonWriterFactory;
import de.cuioss.tools.net.http.HttpHandler;
import de.cuioss.jwt.validation.jwks.http.HttpJwksLoader;
import de.cuioss.jwt.validation.jwks.http.HttpJwksLoaderConfig;
import de.cuioss.jwt.validation.jwks.LoaderStatus;
import de.cuioss.jwt.validation.security.SecurityEventCounter;
import java.io.IOException;
import java.util.Map;

@WebServlet("/nifi-api/processors/jwt/validate-jwks-url")
public class JwksValidationServlet extends HttpServlet {
    
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) 
            throws ServletException, IOException {
        
        // 1. Parse JSON request body
        JsonObject requestJson;
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            requestJson = reader.readObject();
        } catch (JsonException e) {
            resp.setStatus(400);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Invalid JSON format\",\"valid\":false}");
            }
            return;
        }
        
        // 2. Validate required fields
        if (!requestJson.containsKey("jwksUrl")) {
            resp.setStatus(400);
            resp.setContentType("application/json");
            try (var writer = resp.getWriter()) {
                writer.write("{\"error\":\"Missing required field: jwksUrl\",\"valid\":false}");
            }
            return;
        }
        
        String jwksUrl = requestJson.getString("jwksUrl");
        
        // 3. Validate JWKS URL using HttpJwksLoader
        boolean accessible = false;
        String error = "";
        
        try {
            // Create HttpHandler for the JWKS URL
            HttpHandler handler = HttpHandler.builder()
                .uri(jwksUrl)
                .connectionTimeoutSeconds(5)
                .readTimeoutSeconds(10)
                .build();
            
            // Create HttpJwksLoaderConfig
            HttpJwksLoaderConfig config = HttpJwksLoaderConfig.builder()
                .httpHandler(handler)
                .build();
            
            // Create HttpJwksLoader and initialize it
            HttpJwksLoader loader = new HttpJwksLoader(config);
            loader.initJWKSLoader(new SecurityEventCounter());
            
            // Check health - this will trigger loading and validation
            LoaderStatus status = loader.isHealthy();
            accessible = (status == LoaderStatus.OK);
            
            if (!accessible) {
                error = "JWKS URL not accessible or invalid content";
            }
            
        } catch (IllegalArgumentException e) {
            accessible = false;
            error = "Invalid JWKS URL: " + e.getMessage();
        } catch (IllegalStateException e) {
            accessible = false;
            error = "JWKS loader error: " + e.getMessage();
        }
        
        // 4. Build response
        JsonObject responseJson = Json.createObjectBuilder()
            .add("valid", accessible)
            .add("accessible", accessible)
            .add("error", error)
            .build();
        
        resp.setContentType("application/json");
        resp.setStatus(accessible ? 200 : 400);
        
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
        } catch (IOException e) {
            throw new ServletException("Failed to write response", e);
        }
    }
}
```

### Step 3: Create Shared Configuration Parser

To avoid duplicating the configuration parsing logic between `MultiIssuerJWTTokenAuthenticator` and the REST endpoints, create a shared parser:

```java
package de.cuioss.nifi.processors.auth.config;

import de.cuioss.nifi.authentication.jwt.IssuerConfig;
import de.cuioss.nifi.authentication.jwt.ParserConfig;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shared utility for parsing issuer configurations from processor properties.
 * This avoids duplicating logic between the processor and REST endpoints.
 */
public class IssuerConfigurationParser {
    
    private static final String ISSUER_PREFIX = "issuer.";
    private static final String NAME_SUFFIX = ".name";
    private static final String JWKS_URL_SUFFIX = ".jwks.url";
    private static final String JWKS_FILE_SUFFIX = ".jwks.file";
    private static final String JWKS_CONTENT_SUFFIX = ".jwks.content";
    private static final String AUDIENCE_SUFFIX = ".audience";
    private static final String CLIENT_ID_SUFFIX = ".client.id";
    
    /**
     * Extracts all issuer configurations from processor properties.
     * 
     * @param properties The processor's property map
     * @return List of IssuerConfig objects
     */
    public static List<IssuerConfig> parseIssuerConfigs(Map<String, String> properties) {
        List<IssuerConfig> configs = new ArrayList<>();
        
        int issuerIndex = 1;
        while (properties.containsKey(ISSUER_PREFIX + issuerIndex + NAME_SUFFIX)) {
            String prefix = ISSUER_PREFIX + issuerIndex + ".";
            
            IssuerConfig.Builder builder = IssuerConfig.builder()
                .issuerIdentifier(properties.get(prefix + "name"));
                
            // Add JWKS source (URL, file, or content)
            if (properties.containsKey(prefix + "jwks.url")) {
                builder.jwksUrl(properties.get(prefix + "jwks.url"));
            } else if (properties.containsKey(prefix + "jwks.file")) {
                builder.jwksFile(properties.get(prefix + "jwks.file"));
            } else if (properties.containsKey(prefix + "jwks.content")) {
                builder.jwksContent(properties.get(prefix + "jwks.content"));
            }
            
            // Add optional properties
            if (properties.containsKey(prefix + "audience")) {
                builder.audience(properties.get(prefix + "audience"));
            }
            if (properties.containsKey(prefix + "client.id")) {
                builder.clientId(properties.get(prefix + "client.id"));
            }
            
            configs.add(builder.build());
            issuerIndex++;
        }
        
        return configs;
    }
    
    /**
     * Extracts parser configuration from processor properties.
     * 
     * @param properties The processor's property map
     * @return ParserConfig object
     */
    public static ParserConfig parseParserConfig(Map<String, String> properties) {
        return ParserConfig.builder()
            .maxTokenSize(Integer.parseInt(
                properties.getOrDefault("Maximum Token Size", "16384")))
            // Add other parser config properties as needed
            .build();
    }
}
```

Now update the processor to use this shared parser:

```java
// In MultiIssuerJWTTokenAuthenticator.java
@Override
public TokenValidator getTokenValidator() {
    Map<String, String> properties = context.getProperties()
        .entrySet().stream()
        .collect(Collectors.toMap(
            e -> e.getKey().getName(),
            e -> e.getValue()
        ));
    
    List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(properties);
    ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);
    
    return TokenValidator.builder()
        .parserConfig(parserConfig)
        .issuerConfigs(issuerConfigs)
        .build();
}
```

### Step 4: Implement JwtValidationService

The service now uses the shared parser to avoid duplicating configuration logic:

```java
import de.cuioss.nifi.authentication.jwt.TokenValidator;
import de.cuioss.nifi.authentication.jwt.IssuerConfig;
import de.cuioss.nifi.authentication.jwt.ParserConfig;
import de.cuioss.nifi.processors.auth.config.IssuerConfigurationParser;
import de.cuioss.tools.net.http.HttpHandler;
import de.cuioss.tools.net.http.HttpStatusFamily;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.json.JsonReaderFactory;
import jakarta.json.JsonWriterFactory;
import java.io.StringReader;
import java.net.http.HttpResponse;

public class JwtValidationService {
    
    private static final JsonReaderFactory JSON_READER_FACTORY = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER_FACTORY = Json.createWriterFactory(Map.of());
    
    public TokenValidationResult verifyToken(String token, String processorId) 
            throws IOException, IllegalArgumentException, IllegalStateException {
        
        // 1. Get processor configuration via NiFi REST API
        ProcessorDTO processor = fetchProcessorConfig(processorId);
        
        // 2. Get processor properties as a map
        Map<String, String> properties = processor.getConfig().getProperties();
        
        // 3. Use shared parser to extract configurations (same logic as processor)
        List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(properties);
        ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);
        
        // 4. Build TokenValidator exactly as the processor does
        TokenValidator validator = TokenValidator.builder()
            .parserConfig(parserConfig)
            .issuerConfigs(issuerConfigs)
            .build();
        
        // 5. Validate token using the same logic as the processor
        try {
            AccessTokenContent tokenContent = validator.createAccessToken(token);
            return TokenValidationResult.success(tokenContent);
        } catch (TokenValidationException e) {
            return TokenValidationResult.failure(e.getMessage());
        }
    }
    
    private ProcessorDTO fetchProcessorConfig(String processorId) 
            throws IOException, IllegalArgumentException {
        // Call NiFi REST API to get processor configuration
        // This assumes the servlet runs within NiFi context
        // Determine if HTTPS is enabled based on system properties
        String nifiHttpsHost = System.getProperty("nifi.web.https.host");
        String nifiHttpsPort = System.getProperty("nifi.web.https.port");
        String nifiHttpHost = System.getProperty("nifi.web.http.host", "localhost");
        String nifiHttpPort = System.getProperty("nifi.web.http.port", "8080");
        
        String nifiApiUrl;
        if (nifiHttpsHost != null && nifiHttpsPort != null) {
            nifiApiUrl = String.format("https://%s:%s/nifi-api/processors/%s", 
                                      nifiHttpsHost, nifiHttpsPort, processorId);
        } else {
            nifiApiUrl = String.format("http://%s:%s/nifi-api/processors/%s", 
                                      nifiHttpHost, nifiHttpPort, processorId);
        }
        
        // Create HttpHandler for the request
        HttpHandler handler = HttpHandler.builder()
            .uri(nifiApiUrl)
            .connectionTimeoutSeconds(5)
            .readTimeoutSeconds(10)
            .build();
        
        // Build and send request
        var request = handler.requestBuilder()
            .GET()
            .header("Accept", "application/json")
            .build();
            
        var httpClient = handler.createHttpClient();
        HttpResponse<String> response = httpClient.send(request, 
            HttpResponse.BodyHandlers.ofString());
            
        if (response.statusCode() != 200) {
            throw new IOException("Failed to fetch processor config: HTTP " + response.statusCode());
        }
        
        // Parse JSON response using Jakarta JSON API
        try (JsonReader reader = JSON_READER_FACTORY.createReader(new StringReader(response.body()))) {
            JsonObject root = reader.readObject();
            JsonObject component = root.getJsonObject("component");
            
            // Convert to ProcessorDTO (you'll need to implement this mapping)
            return mapJsonToProcessorDTO(component);
        }
    }
    
    // Note: The configuration parsing logic is now in IssuerConfigurationParser
    // This ensures consistency between the processor and REST endpoints
}
```

### Step 5: Update web.xml
```xml
<web-app>
    <!-- Existing content... -->
    
    <!-- JWT API Servlets -->
    <servlet>
        <servlet-name>JwtVerificationServlet</servlet-name>
        <servlet-class>de.cuioss.nifi.ui.servlets.JwtVerificationServlet</servlet-class>
    </servlet>
    <servlet-mapping>
        <servlet-name>JwtVerificationServlet</servlet-name>
        <url-pattern>/nifi-api/processors/jwt/verify-token</url-pattern>
    </servlet-mapping>
    
    <!-- Add other servlets... -->
</web-app>
```

### Step 6: Implement API Key Authentication

```java
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

@WebFilter("/nifi-api/processors/jwt/*")
public class ApiKeyAuthenticationFilter implements Filter {
    
    private static final ConcurrentHashMap<String, String> apiKeys = new ConcurrentHashMap<>();
    
    /**
     * Generate a unique API key for each processor instance
     */
    public static String generateApiKeyForProcessor(String processorId) {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String apiKey = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        apiKeys.put(processorId, apiKey);
        return apiKey;
    }
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Extract API key from header
        String apiKey = httpRequest.getHeader("X-API-Key");
        String processorId = httpRequest.getHeader("X-Processor-Id");
        
        if (apiKey == null || processorId == null || !isValidApiKey(processorId, apiKey)) {
            httpResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            httpResponse.getWriter().write("{\"error\":\"Invalid or missing API key\"}");
            return;
        }
        
        chain.doFilter(request, response);
    }
    
    private boolean isValidApiKey(String processorId, String apiKey) {
        String expectedKey = apiKeys.get(processorId);
        return expectedKey != null && expectedKey.equals(apiKey);
    }
}
```

### Step 7: UI Integration

The processor passes the API key to the UI when it's opened:

```java
// In the processor's customization method
@Override
public String getCustomUiUrl() {
    String processorId = getIdentifier();
    String apiKey = ApiKeyAuthenticationFilter.generateApiKeyForProcessor(processorId);
    
    // Pass API key as a URL parameter (encrypted/encoded)
    return String.format("/nifi-custom-ui/jwt-validator?processorId=%s&apiKey=%s", 
                        processorId, 
                        URLEncoder.encode(apiKey, StandardCharsets.UTF_8));
}
```

The UI retrieves and uses the API key:
```javascript
// In the UI's initialization code
const urlParams = new URLSearchParams(window.location.search);
const processorId = urlParams.get('processorId');
const apiKey = urlParams.get('apiKey');

// Store securely in memory (not localStorage)
window.jwtAuthConfig = {
    processorId: processorId,
    apiKey: apiKey
};

// In the UI's apiClient.js
const makeAuthenticatedRequest = async (url, options = {}) => {
    const { processorId, apiKey } = window.jwtAuthConfig;
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-API-Key': apiKey,
            'X-Processor-Id': processorId,
            'Content-Type': 'application/json'
        }
    });
};
```

## Integration with cui-jwt-validation Library

Add dependencies to nifi-cuioss-ui/pom.xml:
```xml
<dependency>
    <groupId>de.cuioss.java.libs</groupId>
    <artifactId>cui-jwt-validation</artifactId>
    <version>${cui-jwt-validation.version}</version>
</dependency>
<dependency>
    <groupId>jakarta.json</groupId>
    <artifactId>jakarta.json-api</artifactId>
    <version>${jakarta.json.version}</version>
</dependency>
<dependency>
    <groupId>org.eclipse.parsson</groupId>
    <artifactId>parsson</artifactId>
    <version>${parsson.version}</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>de.cuioss</groupId>
    <artifactId>cui-java-tools</artifactId>
    <version>${cui-java-tools.version}</version>
</dependency>
```

Reuse validation components:
- `TokenValidator` - Main validation class
- `IssuerConfig` - Issuer configuration
- `ParserConfig` - Parser settings
- `SecurityEventCounter` - Metrics tracking

## Testing Strategy

### Unit Testing with RestAssured

Add test dependency:
```xml
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>rest-assured</artifactId>
    <version>${rest-assured.version}</version>
    <scope>test</scope>
</dependency>
```

Example servlet test:
```java
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;

class JwtVerificationServletTest {
    
    @BeforeEach
    void setUp() {
        // Configure RestAssured to point to test server
        RestAssured.baseURI = "http://localhost";
        RestAssured.port = 8080;
        RestAssured.basePath = "/nifi-api/processors/jwt";
    }
    
    @Test
    void shouldVerifyValidToken() {
        String validToken = "eyJ..."; // Valid test token
        String processorId = "processor-123";
        String apiKey = "test-api-key";
        
        Response response = RestAssured
            .given()
                .contentType(ContentType.JSON)
                .header("X-API-Key", apiKey)
                .header("X-Processor-Id", processorId)
                .body("""
                    {
                        "token": "%s",
                        "processorId": "%s"
                    }
                    """.formatted(validToken, processorId))
            .when()
                .post("/verify-token");
        
        assertEquals(200, response.getStatusCode());
        assertEquals("application/json", response.getContentType());
        
        // Parse JSON response
        var jsonPath = response.jsonPath();
        assertTrue(jsonPath.getBoolean("valid"));
        assertNotNull(jsonPath.get("claims"));
        assertNotNull(jsonPath.getString("claims.sub"));
    }
    
    @Test
    void shouldRejectInvalidToken() {
        Response response = RestAssured
            .given()
                .contentType(ContentType.JSON)
                .header("X-API-Key", "test-api-key")
                .header("X-Processor-Id", "processor-123")
                .body("""
                    {
                        "token": "invalid-token",
                        "processorId": "processor-123"
                    }
                    """)
            .when()
                .post("/verify-token");
        
        assertEquals(400, response.getStatusCode());
        
        var jsonPath = response.jsonPath();
        assertFalse(jsonPath.getBoolean("valid"));
        assertTrue(jsonPath.getString("error").contains("Invalid token format"));
    }
    
    @Test
    void shouldRequireApiKey() {
        Response response = RestAssured
            .given()
                .contentType(ContentType.JSON)
                .header("X-Processor-Id", "processor-123")
                // Missing X-API-Key header
                .body("""
                    {
                        "token": "eyJ...",
                        "processorId": "processor-123"
                    }
                    """)
            .when()
                .post("/verify-token");
        
        assertEquals(401, response.getStatusCode());
        
        var jsonPath = response.jsonPath();
        assertEquals("Invalid or missing API key", jsonPath.getString("error"));
    }
}
```

### Testing Approach
Since the servlets run within NiFi's WAR context, test them using:

1. **Unit Tests**: Test servlet logic with manual request/response handling
2. **Integration Tests**: Deploy the WAR to a test NiFi instance and use RestAssured
3. **E2E Tests**: Use the existing Playwright tests

Example unit test without external frameworks:
```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.ServletInputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class JwtVerificationServletTest {
    
    private JwtVerificationServlet servlet;
    private HttpServletRequest mockRequest;
    private HttpServletResponse mockResponse;
    private StringWriter responseWriter;
    
    @BeforeEach
    void setUp() {
        servlet = new JwtVerificationServlet();
        responseWriter = new StringWriter();
        
        // Create test doubles (not mocks)
        mockRequest = new TestHttpServletRequest();
        mockResponse = new TestHttpServletResponse(new PrintWriter(responseWriter));
    }
    
    @Test
    void testValidTokenVerification() throws IOException, ServletException {
        // Given
        ((TestHttpServletRequest) mockRequest).setContent("""
            {
                "token": "valid-jwt",
                "processorId": "test-processor"
            }
            """);
        ((TestHttpServletRequest) mockRequest).setHeader("X-API-Key", "test-key");
        ((TestHttpServletRequest) mockRequest).setHeader("X-Processor-Id", "test-processor");
        
        // When
        servlet.doPost(mockRequest, mockResponse);
        
        // Then
        assertEquals(200, ((TestHttpServletResponse) mockResponse).getStatus());
        String response = responseWriter.toString();
        assertTrue(response.contains("\"valid\":true"));
    }
}

// Simple test implementations
class TestHttpServletRequest extends HttpServletRequestWrapper {
    private String content;
    private Map<String, String> headers = new HashMap<>();
    
    TestHttpServletRequest() {
        super(new HttpServletRequestAdapter());
    }
    
    void setContent(String content) {
        this.content = content;
    }
    
    void setHeader(String name, String value) {
        headers.put(name, value);
    }
    
    @Override
    public String getHeader(String name) {
        return headers.get(name);
    }
    
    @Override
    public ServletInputStream getInputStream() {
        return new TestServletInputStream(content);
    }
}
```

## Security Considerations

### API Key Authentication
1. **Unique keys per processor** - Each processor instance gets its own API key generated on startup
2. **Secure key generation** - Use `SecureRandom` with sufficient entropy (256 bits)
3. **Key rotation** - Keys are regenerated when processor is restarted
4. **No external access** - API is only accessible from the processor's configuration UI
5. **Key storage** - Keys are stored in memory only, never persisted

### Additional Security Measures
1. **Input Validation**: Validate all JSON inputs before processing
2. **Rate Limiting**: Implement per-processor rate limiting for token verification
3. **Audit Logging**: Log all API access attempts with processor ID
4. **No CORS needed**: Since this is an internal API, CORS is disabled for security

## Conclusion

This implementation provides REST endpoints for JWT token verification while maintaining consistency with the NiFi architecture. Key benefits include:

- **Shared Configuration Logic**: The `IssuerConfigurationParser` ensures both the processor and REST endpoints use identical configuration parsing, eliminating code duplication
- **Security**: API key authentication provides secure access without exposing endpoints externally
- **Standards Compliance**: Uses Jakarta EE 10, Jakarta JSON API, and project utilities (HttpHandler)
- **Maintainability**: Single source of truth for configuration parsing makes updates easier
- **Testability**: Clear separation of concerns allows for comprehensive unit and integration testing

The shared parser pattern ensures that any changes to issuer configuration handling are automatically reflected in both the processor and REST endpoints, maintaining consistency across the system.

## References and Sources

### Official Documentation
1. **Apache NiFi Developer Guide** (v1.19.0)
   - Section: "Custom User Interfaces"
   - URL: https://nifi.apache.org/docs/nifi-docs/html/developer-guide.html#custom-ui
   
2. **Apache NiFi REST API Reference**
   - URL: https://nifi.apache.org/docs/nifi-docs/rest-api/index.html
   
3. **Jakarta EE 10 Platform Specification**
   - URL: https://jakarta.ee/specifications/platform/10/
   - Note: NiFi 2.4.0 uses Jakarta EE 10, not the older Java EE
   
4. **Jakarta Servlet 6.0 Specification** (part of Jakarta EE 10)
   - URL: https://jakarta.ee/specifications/servlet/6.0/

### Testing Resources
1. **RestAssured Documentation**
   - Official Site: https://rest-assured.io/
   - User Guide: https://github.com/rest-assured/rest-assured/wiki/Usage
   
2. **JUnit 5 Documentation**
   - Official Site: https://junit.org/junit5/
   - User Guide: https://junit.org/junit5/docs/current/user-guide/

### Security References
1. **OWASP REST Security Cheat Sheet**
   - URL: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
   
2. **JWT Best Practices** (RFC 8725)
   - URL: https://datatracker.ietf.org/doc/html/rfc8725

## Implementation Summary (2025-01-27)

### What Was Implemented
1. **Backend REST API Endpoints**:
   - `/nifi-api/processors/jwt/verify-token` - Token verification with claims extraction
   - `/nifi-api/processors/jwt/validate-jwks` - JWKS validation (URL, file, content)
   - `/nifi-api/processors/jwt/metrics` - Security metrics endpoint

2. **Core Services**:
   - `IssuerConfigurationParser` - Shared configuration parsing logic
   - `JwtValidationService` - Token validation using cui-jwt-validation
   - `ProcessorConfigReader` - Fetches processor config via NiFi REST API
   - `ApiKeyAuthenticationFilter` - Per-processor API key authentication

3. **Technical Decisions**:
   - Used Jakarta EE 10 (not javax) for NiFi 2.4.0 compatibility
   - Standard Java HTTP client instead of cui-java-tools HttpHandler
   - REST API approach for configuration access
   - Shared parser to maintain consistency with processor

### What's Missing
1. **Frontend UI Integration**:
   - UI components not connected to REST endpoints
   - Processor configuration dialog missing custom tabs
   - API key generation and passing to UI
   - JavaScript code to call REST endpoints

2. **Testing**:
   - Unit tests for servlets
   - Integration tests with NiFi
   - E2E tests expecting UI components fail

### Next Steps
To complete the implementation:
1. Generate API keys in processor and pass to UI
2. Update JavaScript to call REST endpoints with authentication
3. Ensure UI tabs display data from API responses
4. Fix E2E tests or update them to match implementation approach
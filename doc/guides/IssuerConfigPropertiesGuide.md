# Step-by-Step Guide: Working with IssuerConfig Properties in NiFi UI

This guide provides detailed instructions for working with the MultiIssuerJWTTokenAuthenticator processor and its IssuerConfig properties in the NiFi UI.

## Prerequisites

- Docker and Docker Compose installed
- NiFi test environment set up (see [Test Environment Setup](#test-environment-setup))

## Test Environment Setup

1. Clone the repository (if you haven't already)
2. Navigate to the repository root
3. Start the test environment:
   ```bash
   ./integration-testing/src/main/docker/run-test-container.sh
   ```
4. Access NiFi UI at https://localhost:9095/nifi/ (credentials: admin/adminadminadmin)

## Adding the Processor to the Canvas

1. Log in to the NiFi UI using the credentials: admin/adminadminadmin
2. Drag and drop a new processor onto the canvas:
   - Click the processor icon in the toolbar
   - Search for "MultiIssuerJWTTokenAuthenticator"
   - Drag it onto the canvas
3. Right-click on the processor and select "Configure"

## Configuring the Processor

### Basic Configuration

1. In the "Settings" tab:
   - Set a name for the processor (optional)
   - Set scheduling strategy (e.g., "Timer driven")
   - Set run schedule (e.g., "1 sec")

2. In the "Properties" tab:
   - Configure basic properties:
     - Token Location: AUTHORIZATION_HEADER (default)
     - Token Header: Authorization (default)
     - Require Valid Token: true (default)
     - JWKS Refresh Interval: 3600 (default)
     - Maximum Token Size: 16384 (default)
     - Allowed Algorithms: RS256,RS384,RS512,ES256,ES384,ES512,PS256,PS384,PS512 (default)
     - Require HTTPS for JWKS URLs: true (default)

### Configuring Issuer Properties

There are two ways to configure issuer properties:

#### Method 1: Using the Custom Issuer Configuration Tab

1. In the processor configuration dialog, look for the "Issuer Configuration" tab (it should appear alongside the standard "Settings", "Scheduling", and "Properties" tabs)
2. If the tab is visible, click on it to access the issuer configuration interface
3. The interface should display:
   - A list of existing issuer configurations (if any)
   - An "Add Issuer" button to create new configurations

4. To add a new issuer:
   - Click the "Add Issuer" button
   - Enter an issuer name (e.g., "keycloak")
   - Fill in the required fields:
     - Issuer URI: The URI of the token issuer (must match the "iss" claim in the JWT)
       - Example: `http://keycloak:9080/realms/oauth_integration_tests`
     - JWKS URL: The URL of the JWKS endpoint
       - Example: `http://keycloak:9080/realms/oauth_integration_tests/protocol/openid-connect/certs`
     - Audience (optional): The expected audience claim value
     - Client ID (optional): The client ID for token validation
   - Click "Save Issuer"

#### Method 2: Using Dynamic Properties (Manual Configuration)

If the custom tab is not visible or not functioning properly, you can configure issuers using dynamic properties:

1. In the "Properties" tab, click the "+" button to add a new property
2. Add properties in the format `issuer.<issuer-name>.<property-key>`:
   - `issuer.keycloak.issuer`: The URI of the token issuer
     - Example: `http://keycloak:9080/realms/oauth_integration_tests`
   - `issuer.keycloak.jwks-url`: The URL of the JWKS endpoint
     - Example: `http://keycloak:9080/realms/oauth_integration_tests/protocol/openid-connect/certs`
   - `issuer.keycloak.audience` (optional): The expected audience claim value
   - `issuer.keycloak.client-id` (optional): The client ID for token validation
3. Click "Apply" to save the properties

## Testing the Configuration

1. Apply the configuration changes
2. Start the processor
3. Obtain a test token from Keycloak:
   ```bash
   curl -X POST \
     http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'grant_type=password&client_id=test_client&client_secret=yTKslWLtf4giJcWCaoVJ20H8sy6STexM&username=testUser&password=drowssap'
   ```
4. Create a test flow to send the token to the processor:
   - Add a GenerateFlowFile processor
   - Connect it to the MultiIssuerJWTTokenAuthenticator
   - Configure GenerateFlowFile to add the token as an attribute:
     - Property name: `http.headers.authorization`
     - Property value: `Bearer <token>` (replace `<token>` with the access_token value from the Keycloak response)
5. Start the flow and observe the results

## Troubleshooting

### Custom UI Tab Not Visible

If the "Issuer Configuration" tab is not visible:

1. Check browser console for errors (F12 > Console)
2. Verify that the custom UI components are loaded:
   - Look for messages like "[DEBUG_LOG] Loading CSS for custom UI components"
   - Check for errors related to loading JavaScript or CSS files
3. Try refreshing the page or using a different browser
4. Fall back to using dynamic properties (Method 2) for configuration

### Configuration Not Applied

If the issuer configuration is not being applied:

1. Check the NiFi logs for errors:
   ```bash
   docker compose -f integration-testing/src/main/docker/docker-compose.yml logs nifi
   ```
2. Verify that the processor is properly configured:
   - Check that the JWKS URL is correct and accessible
   - Ensure the issuer URI matches the "iss" claim in the JWT
3. Try restarting the processor

### Token Validation Failures

If tokens are not being validated correctly:

1. Check the token claims using the "Token Verification" tab (if available)
2. Verify that the token is not expired
3. Ensure the issuer URI in the configuration matches the "iss" claim in the token
4. Check that the JWKS URL is accessible and returns valid keys
5. Verify that the token's signing algorithm is in the list of allowed algorithms

## Advanced Configuration

### Multiple Issuers

You can configure multiple issuers by repeating the steps above with different issuer names:

1. Using the custom tab:
   - Click "Add Issuer" for each issuer
   - Use different names for each issuer (e.g., "keycloak", "auth0")

2. Using dynamic properties:
   - Add properties with different issuer names:
     - `issuer.keycloak.jwks-url`: For Keycloak
     - `issuer.auth0.jwks-url`: For Auth0

### External Configuration

The processor also supports loading configuration from external sources:

1. Environment variables
2. Configuration files

Refer to the processor documentation for details on external configuration options.
/**
 * @file Self-test for Keycloak Token Service
 * Validates that the token service can fetch valid tokens and handle errors appropriately
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import {
    KeycloakTokenService,
    getValidAccessToken,
    getInvalidAccessToken,
} from "../utils/keycloak-token-service.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Keycloak Token Service", () => {
    let tokenService;

    test.beforeEach(() => {
        tokenService = new KeycloakTokenService();
    });

    test("should check if Keycloak is accessible", async () => {
        const isAccessible = await tokenService.isKeycloakAccessible();

        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: Keycloak is not accessible. " +
                "Run ./integration-testing/src/main/docker/run-and-deploy.sh to start containers."
            );
        }

        expect(isAccessible).toBe(true);
    });

    test("should fetch a valid access token from Keycloak", async () => {
        // Fail if Keycloak is not accessible
        const isAccessible = await tokenService.isKeycloakAccessible();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: Keycloak is not accessible. " +
                "Run ./integration-testing/src/main/docker/run-and-deploy.sh to start containers."
            );
        }

        // Fetch the token
        const token = await getValidAccessToken();

        // Validate token structure
        expect(token).toBeTruthy();
        expect(typeof token).toBe("string");

        // JWT should have 3 parts separated by dots
        const parts = token.split(".");
        expect(parts).toHaveLength(3);

        // Decode and validate the payload
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

        // Check expected claims
        expect(payload).toHaveProperty("sub");
        expect(payload).toHaveProperty("iss");
        expect(payload).toHaveProperty("exp");
        expect(payload).toHaveProperty("iat");

        // Verify the token is not expired
        const now = Math.floor(Date.now() / 1000);
        expect(payload.exp).toBeGreaterThan(now);
    });

    test("should fail loudly when Keycloak is not accessible", async () => {
        // Temporarily suppress error logging for this test since we expect it to fail
        const { authLogger } = await import('../utils/shared-logger.js');
        const originalError = authLogger.error;
        authLogger.error = () => {}; // Suppress error logging
        
        try {
            // Create a service with invalid endpoint
            const badService = new KeycloakTokenService();
            badService.keycloakBase = "http://localhost:99999"; // Invalid port
            badService.tokenEndpoint = `${badService.keycloakBase}/realms/${badService.realm}/protocol/openid-connect/token`;

            // Should throw with helpful error message
            await expect(badService.getValidAccessToken()).rejects.toThrow(
                /CRITICAL: Failed to obtain access token from Keycloak/,
            );
            await expect(badService.getValidAccessToken()).rejects.toThrow(
                /run-and-deploy.sh/,
            );
        } finally {
            // Restore original error logging
            authLogger.error = originalError;
        }
    });

    test("should fail loudly with invalid credentials", async () => {
        // Fail if Keycloak is not accessible
        const isAccessible = await tokenService.isKeycloakAccessible();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: Keycloak is not accessible. " +
                "Run ./integration-testing/src/main/docker/run-and-deploy.sh to start containers."
            );
        }

        // Create a custom token service instance
        const customService = new KeycloakTokenService();

        // Override the getValidAccessToken to use wrong credentials
        customService.getValidAccessToken = async function () {
            const response = await fetch(this.tokenEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "password",
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    username: "wronguser",
                    password: "wrongpassword",
                    scope: "openid",
                }),
            });

            if (!response.ok) {
                const errorBody = await response
                    .text()
                    .catch(() => "Unknown error");
                throw new Error(
                    `Failed to obtain access token from Keycloak. ` +
                        `Status: ${response.status} ${response.statusText}. ` +
                        `Response: ${errorBody}. ` +
                        `Endpoint: ${this.tokenEndpoint}`,
                );
            }

            const tokenData = await response.json();
            return tokenData.access_token;
        };

        // Should throw with authentication error
        await expect(customService.getValidAccessToken()).rejects.toThrow(
            /Failed to obtain access token from Keycloak/,
        );
    });

    test("should return a static invalid access token", () => {
        const invalidToken = getInvalidAccessToken();

        // Should return a string
        expect(invalidToken).toBeTruthy();
        expect(typeof invalidToken).toBe("string");

        // Should have JWT structure (3 parts)
        const parts = invalidToken.split(".");
        expect(parts).toHaveLength(3);

        // Should contain "invalid" in the signature
        expect(parts[2]).toContain("invalid");

        // Should always return the same token
        const secondToken = getInvalidAccessToken();
        expect(secondToken).toBe(invalidToken);
    });

    test("should expose token endpoint for debugging", () => {
        const endpoint = tokenService.getTokenEndpoint();

        expect(endpoint).toBeTruthy();
        expect(endpoint).toContain(
            "/realms/oauth_integration_tests/protocol/openid-connect/token",
        );
        expect(endpoint).toContain(CONSTANTS.SERVICE_URLS.KEYCLOAK_BASE);
    });

    test("convenience functions should work correctly", async () => {
        // Test invalid token function
        const invalidToken = getInvalidAccessToken();
        expect(invalidToken).toBeTruthy();
        expect(typeof invalidToken).toBe("string");

        // Test valid token function if Keycloak is accessible
        const isAccessible = await tokenService.isKeycloakAccessible();
        if (isAccessible) {
            const validToken = await getValidAccessToken();
            expect(validToken).toBeTruthy();
            expect(typeof validToken).toBe("string");
            expect(validToken.split(".")).toHaveLength(3);
        }
    });
});

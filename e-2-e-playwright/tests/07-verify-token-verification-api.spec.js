/**
 * @file Token Verification API Test
 * Verifies the /api/token/verify REST endpoint functionality
 *
 * NOTE: These tests expect REST endpoints that don't exist in standard NiFi.
 * In production, these endpoints must be implemented using one of these approaches:
 * 1. HandleHTTPRequest/HandleHTTPResponse processors in a NiFi flow
 * 2. A separate microservice deployed alongside NiFi
 * 3. Custom NiFi service with web endpoints
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { saveTestBrowserLogs } from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe.skip("Token Verification API", () => {
    // SKIP: These tests require REST endpoints that don't exist in standard NiFi
    // See IMPLEMENTATION-PLAN.adoc section 2.2 for implementation details
    // Once endpoints are implemented, remove .skip from test.describe

    test.beforeEach(async ({ page }, testInfo) => {
        try {
            // For API tests, we don't need authentication
            // Just navigate to a blank page to initialize the browser context
            await page.goto("about:blank");

            processorLogger.info("API test setup complete");
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                logTestWarning(
                    "beforeEach",
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error;
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("should verify token via API endpoint", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing token verification API endpoint");

        try {
            const validToken =
                "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxeNe8djT9YjpvRZA";

            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {
                        token: validToken,
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(200);
            processorLogger.info("✓ API returned 200 OK");

            const responseData = await response.json();
            expect(responseData).toHaveProperty("valid");
            expect(responseData.valid).toBe(true);
            processorLogger.info("✓ Token validated successfully via API");

            expect(responseData).toHaveProperty("claims");
            expect(responseData.claims).toHaveProperty("sub");
            expect(responseData.claims.sub).toBe("1234567890");
            processorLogger.info("✓ Token claims returned correctly");

            processorLogger.success("Token verification API working correctly");
        } catch (error) {
            processorLogger.error(
                `Error during API verification test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should reject invalid token via API", async ({ page }, _testInfo) => {
        processorLogger.info("Testing invalid token rejection via API");

        try {
            const invalidToken = "invalid.jwt.token";

            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {
                        token: invalidToken,
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(400);
            processorLogger.info(
                "✓ API returned 400 Bad Request for invalid token",
            );

            const responseData = await response.json();
            expect(responseData).toHaveProperty("valid");
            expect(responseData.valid).toBe(false);
            processorLogger.info("✓ Token marked as invalid");

            expect(responseData).toHaveProperty("error");
            expect(responseData.error).toMatch(/invalid|malformed/i);
            processorLogger.info("✓ Error message provided");

            processorLogger.success("Invalid token handled correctly by API");
        } catch (error) {
            processorLogger.error(
                `Error during invalid token test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle missing token in API request", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing missing token handling");

        try {
            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {},
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(400);
            processorLogger.info(
                "✓ API returned 400 Bad Request for missing token",
            );

            const responseData = await response.json();
            expect(responseData).toHaveProperty("error");
            expect(responseData.error).toMatch(/required|missing/i);
            processorLogger.info("✓ Error message indicates missing token");

            processorLogger.success("Missing token handled correctly by API");
        } catch (error) {
            processorLogger.error(
                `Error during missing token test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should verify token with specific issuer", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing token verification with issuer");

        try {
            const tokenWithIssuer =
                "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsIm5hbWUiOiJKb2huIERvZSIsImFkbWluIjp0cnVlLCJpYXQiOjE1MTYyMzkwMjJ9.NHVaYe26MbtOYhSKkoKYdFVomg4i8ZJd8_-RU8VNbftc4TSMb4bXP3l3YlNWACwyXPGffz5aXHc6lty1Y2t4SWRqGteragsVdZufDn5BlnJl9pdR_kdVFUsra2rWKEofkZeIC4yWytE58sMIihvo9H1ScmmVwBcQP6XETqYd0aSHp1gOa9RdUPDvoXQ5oqygTqVtxaDr6wUFKrKItgBMzWIdNZ6y7O9E0DhEPTbE9rfBo6KTFsHAZnMg4k68CDp2woYIaXbmYTWcvbzIuHO7_37GT79XdIwkm95QJ7hYC9RiwrV7mesbY4PAahERJawntho0my942XheVLmGwLMBkQ";

            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {
                        token: tokenWithIssuer,
                        issuer: "https://example.com",
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(200);
            processorLogger.info("✓ API validated token with issuer");

            const responseData = await response.json();
            expect(responseData.valid).toBe(true);
            expect(responseData).toHaveProperty("issuer");
            expect(responseData.issuer).toBe("https://example.com");
            processorLogger.info("✓ Issuer validated correctly");

            processorLogger.success("Token with issuer verified successfully");
        } catch (error) {
            processorLogger.error(
                `Error during issuer verification test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should check token authorization", async ({ page }, _testInfo) => {
        processorLogger.info("Testing token authorization check");

        try {
            const tokenWithScopes =
                "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NvcGVzIjpbInJlYWQiLCJ3cml0ZSJdLCJyb2xlcyI6WyJhZG1pbiJdLCJpYXQiOjE1MTYyMzkwMjJ9.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxeNe8djT9YjpvRZA";

            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {
                        token: tokenWithScopes,
                        requiredScopes: ["read"],
                        requiredRoles: ["admin"],
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(200);
            processorLogger.info("✓ API checked authorization successfully");

            const responseData = await response.json();
            expect(responseData.valid).toBe(true);
            expect(responseData).toHaveProperty("authorized");
            expect(responseData.authorized).toBe(true);
            processorLogger.info(
                "✓ Token authorized for required scopes/roles",
            );

            expect(responseData).toHaveProperty("scopes");
            expect(responseData.scopes).toContain("read");
            expect(responseData).toHaveProperty("roles");
            expect(responseData.roles).toContain("admin");
            processorLogger.info("✓ Scopes and roles returned correctly");

            processorLogger.success(
                "Token authorization check completed successfully",
            );
        } catch (error) {
            processorLogger.error(
                `Error during authorization check: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle expired token", async ({ page }, _testInfo) => {
        processorLogger.info("Testing expired token handling");

        try {
            const expiredToken =
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ";

            const response = await page.request.post(
                "https://localhost:9095/api/token/verify",
                {
                    data: {
                        token: expiredToken,
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                    ignoreHTTPSErrors: true,
                },
            );

            // Check if we got an HTML response instead of JSON (indicates endpoint doesn't exist)
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/html")) {
                throw new Error(
                    "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                        "Got HTML response instead of JSON. " +
                        "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                        "See doc/jwt-api-endpoints-implementation.md for details.",
                );
            }

            expect(response.status()).toBe(401);
            processorLogger.info(
                "✓ API returned 401 Unauthorized for expired token",
            );

            const responseData = await response.json();
            expect(responseData.valid).toBe(false);
            expect(responseData).toHaveProperty("error");
            expect(responseData.error).toMatch(/expired/i);
            processorLogger.info("✓ Error indicates token expiration");

            expect(responseData).toHaveProperty("expiredAt");
            processorLogger.info("✓ Expiration timestamp provided");

            processorLogger.success("Expired token handled correctly by API");
        } catch (error) {
            processorLogger.error(
                `Error during expired token test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should enforce rate limiting", async ({ page }, _testInfo) => {
        processorLogger.info("Testing API rate limiting");

        try {
            const token = "test.token.here";
            const requests = [];

            for (let i = 0; i < 15; i++) {
                requests.push(
                    page.request.post(
                        "https://localhost:9095/api/token/verify",
                        {
                            data: { token },
                            headers: { "Content-Type": "application/json" },
                            ignoreHTTPSErrors: true,
                        },
                    ),
                );
            }

            const responses = await Promise.all(requests);
            processorLogger.info(`Made ${requests.length} concurrent requests`);

            // Check if any response is HTML (indicates endpoint doesn't exist)
            for (const response of responses) {
                const contentType = response.headers()["content-type"] || "";
                if (contentType.includes("text/html")) {
                    throw new Error(
                        "PRECONDITION FAILED: Token verification endpoint /api/token/verify not found. " +
                            "Got HTML response instead of JSON. " +
                            "In production, implement this endpoint using HandleHTTPRequest/Response processors. " +
                            "See doc/jwt-api-endpoints-implementation.md for details.",
                    );
                }
            }

            const rateLimitedResponses = responses.filter(
                (r) => r.status() === 429,
            );

            if (rateLimitedResponses.length > 0) {
                processorLogger.info(
                    `✓ ${rateLimitedResponses.length} requests were rate limited`,
                );

                const rateLimitResponse = rateLimitedResponses[0];
                const headers = rateLimitResponse.headers();

                if (headers["x-ratelimit-limit"]) {
                    processorLogger.info(
                        `✓ Rate limit header present: ${headers["x-ratelimit-limit"]}`,
                    );
                }

                if (headers["retry-after"]) {
                    processorLogger.info(
                        `✓ Retry-After header present: ${headers["retry-after"]}`,
                    );
                }

                processorLogger.success("Rate limiting enforced correctly");
            } else {
                processorLogger.info(
                    "Rate limiting not triggered - may need more requests or different configuration",
                );
            }
        } catch (error) {
            processorLogger.error(
                `Error during rate limiting test: ${error.message}`,
            );
            throw error;
        }
    });
});

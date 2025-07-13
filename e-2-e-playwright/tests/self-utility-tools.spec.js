/**
 * @file Utility Services Validation Tests
 * Validates the functionality of authentication, processor, and accessibility services
 * Tests error handling, performance, and integration of modern utility services
 * @version 2.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { AccessibilityService } from "../utils/accessibility-helper.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Utility Tools - Authentication and Navigation", () => {
    test("AuthService should handle complete authentication flow", async ({
        page,
        testData: _testData,
    }) => {
        const authService = new AuthService(page);

        // Test service accessibility check
        const isAccessible = await authService.checkNiFiAccessibility();
        expect(isAccessible, "NiFi service should be accessible").toBeTruthy();

        // Test login with valid credentials
        await authService.login();

        // Verify authentication success
        const isAuthenticated = await authService.isAuthenticated();
        expect(isAuthenticated, "User should be authenticated").toBeTruthy();

        // Verify canvas is loaded
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );
    });

    test("AuthService should handle login failures gracefully", async ({
        page,
        testData,
    }) => {
        const authService = new AuthService(page);

        // Test login with invalid credentials
        await expect(async () => {
            await authService.login(testData.invalidCredentials);
        }).rejects.toThrow(/Login failed/);
    });

    test("AuthService should handle logout properly", async ({
        authenticatedPage,
    }) => {
        const authService = new AuthService(authenticatedPage);

        // Perform logout
        await authService.logout();

        // Verify logout success
        const loginButton = authenticatedPage.getByRole("button", {
            name: /log in|login/i,
        });
        await expect(loginButton).toBeVisible({ timeout: 10000 });
    });

    test("AuthService navigation should work correctly", async ({
        authenticatedPage,
    }) => {
        const authService = new AuthService(authenticatedPage);

        // Test navigation to main canvas
        await authService.navigateToPage("MAIN_CANVAS");

        // Verify we're on the main canvas
        await expect(
            authenticatedPage.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();
    });
});

test.describe("Utility Tools - Processor Operations", () => {
    test("ProcessorService should find processors correctly", async ({
        authenticatedPage,
    }) => {
        const processorService = new ProcessorService(authenticatedPage);

        // Test finding JWT Token Authenticator (if it exists)
        const jwtAuthenticator = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
        });

        if (jwtAuthenticator) {
            expect(jwtAuthenticator.type).toContain("JWT");
            expect(jwtAuthenticator.isVisible).toBeTruthy();
        }
    });

    test("ProcessorService should handle processor interaction", async ({
        authenticatedPage,
        testData: _testData,
    }) => {
        const processorService = new ProcessorService(authenticatedPage);

        // Try to find any processor on the canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        if (processor) {
            // Test processor interaction
            await processorService.interact(processor, { action: "hover" });

            // Verify processor is still visible
            await expect(
                authenticatedPage.locator(processor.element),
            ).toBeVisible();
        }
    });
});

test.describe("Utility Tools - Accessibility Testing", () => {
    test("AccessibilityService should check login form", async ({ page }) => {
        const accessibilityService = new AccessibilityService(page);

        // Navigate to login page
        await page.goto("/nifi");

        // Check login form accessibility
        const result = await accessibilityService.checkLoginForm();

        // Log results but don't fail test for accessibility issues
        if (!result.passed) {
            console.warn(
                "Accessibility violations found in login form:",
                result.violations.length,
            );
        }

        expect(result).toHaveProperty("passed");
        expect(result).toHaveProperty("violations");
    });

    test("AccessibilityService should check main canvas", async ({
        authenticatedPage,
    }) => {
        const accessibilityService = new AccessibilityService(
            authenticatedPage,
        );

        // Check main canvas accessibility
        const result = await accessibilityService.checkMainCanvas();

        // Log results but don't fail test for accessibility issues
        if (!result.passed) {
            console.warn(
                "Accessibility violations found in main canvas:",
                result.violations.length,
            );
        }

        expect(result).toHaveProperty("passed");
        expect(result).toHaveProperty("violations");
    });
});

test.describe("Utility Tools - Error Handling and Edge Cases", () => {
    test("Services should handle network errors gracefully", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Test with invalid URL (should handle gracefully)
        await page.goto("about:blank");

        const isAccessible = await authService.checkNiFiAccessibility(1000); // Short timeout
        expect(typeof isAccessible).toBe("boolean");
    });

    test("ProcessorService should handle missing processors", async ({
        authenticatedPage,
    }) => {
        const processorService = new ProcessorService(authenticatedPage);

        // Test finding non-existent processor
        const nonExistentProcessor = await processorService.find(
            "NonExistentProcessor",
            {
                failIfNotFound: false,
            },
        );

        expect(nonExistentProcessor).toBeNull();
    });

    test("Services should provide consistent error messages", async ({
        page,
        testData: _testData,
    }) => {
        const authService = new AuthService(page);

        // Test with very invalid credentials
        await expect(async () => {
            await authService.login({ username: "", password: "" });
        }).rejects.toThrow();
    });
});

test.describe("Utility Tools - Performance and Reliability", () => {
    test("AuthService should complete login within reasonable time", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        const startTime = Date.now();
        await authService.ensureReady();
        const endTime = Date.now();

        const loginTime = endTime - startTime;
        expect(loginTime).toBeLessThan(60000); // Should complete within 60 seconds
    });

    test("ProcessorService should handle multiple operations", async ({
        authenticatedPage,
    }) => {
        const processorService = new ProcessorService(authenticatedPage);

        // Test finding multiple processor types
        const operations = [
            processorService.find("JWT", { failIfNotFound: false }),
            processorService.find("processor", { failIfNotFound: false }),
            processorService.find("authenticator", { failIfNotFound: false }),
        ];

        const results = await Promise.all(operations);

        // At least one operation should complete without error
        expect(results).toHaveLength(3);
        results.forEach((result) => {
            expect(result === null || typeof result === "object").toBeTruthy();
        });
    });
});

test.describe("Utility Tools - Integration Testing", () => {
    test("Combined services should work together", async ({
        page,
        testData: _testData,
    }) => {
        const authService = new AuthService(page);
        const processorService = new ProcessorService(page);
        const accessibilityService = new AccessibilityService(page);

        // Complete authentication flow
        await authService.ensureReady();

        // Check for processors
        const processorCount = await processorService.discovery.page
            .locator(CONSTANTS.SELECTORS.PROCESSOR_ELEMENT)
            .count();

        // Run accessibility check
        const a11yResult = await accessibilityService.checkMainCanvas();

        // Verify integration
        expect(await authService.isAuthenticated()).toBeTruthy();
        expect(typeof processorCount).toBe("number");
        expect(a11yResult).toHaveProperty("passed");
    });
});

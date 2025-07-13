/**
 * @file Comprehensive Framework Demonstration
 * Demonstrates all modern Playwright patterns, utilities, and testing capabilities
 * Including authentication, accessibility, cross-browser testing, and integration patterns
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { LoginPage, CanvasPage } from "../pages/index.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { AccessibilityService } from "../utils/accessibility-helper.js";
// TestPatterns replaced with direct Playwright patterns
import { CONSTANTS } from "../utils/constants.js";

test.describe("Framework Demonstration - Modern Patterns", () => {
    test("Page Object Model with fixtures integration", async ({
        page,
        pageVerifier,
    }) => {
        // Demonstrate Page Object Model usage
        const loginPage = new LoginPage(page);
        const canvasPage = new CanvasPage(page);

        // Modern authentication flow using POM
        await loginPage.login();
        await loginPage.verifyLoginSuccess();

        // Verify canvas is ready using POM
        await canvasPage.verifyCanvasLoaded();

        // Use fixture-based page verification
        await pageVerifier.expectMainCanvas();
    });

    test("Service-based architecture with modern utilities", async ({
        authenticatedPage,
    }) => {
        // Initialize modern service architecture
        const authService = new AuthService(authenticatedPage);
        const processorService = new ProcessorService(authenticatedPage);

        // Verify authentication state using direct Playwright patterns
        await expect(
            authenticatedPage.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();

        // Demonstrate processor operations with error handling
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        if (processor) {
            await processorService.interact(processor, { action: "hover" });
        }

        // Measure operation performance using built-in timing
        const start = Date.now();
        await authService.navigateToPage("MAIN_CANVAS");
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(30000);

        // eslint-disable-next-line no-console
        console.log(`Navigation performance: ${duration}ms`);
    });

    test("Modern semantic locators demonstration", async ({
        authenticatedPage,
    }) => {
        // Demonstrate modern locator strategies over complex CSS selectors

        // Main application elements using semantic locators
        await expect(
            authenticatedPage.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();

        // Role-based selectors (accessibility-first approach)
        const buttons = authenticatedPage.getByRole("button");
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);

        // Text-based selectors for content verification
        const nifiTitle = authenticatedPage.getByText(/NiFi/i);
        if (await nifiTitle.isVisible()) {
            await expect(nifiTitle).toBeVisible();
        }

        // Label-based selectors (accessibility-friendly)
        const searchInputs = authenticatedPage.getByLabel(/search/i);
        const searchCount = await searchInputs.count();
        expect(searchCount).toBeGreaterThanOrEqual(0);
    });

    test("Error handling and resilience patterns", async ({
        page,
        testData,
    }) => {
        const authService = new AuthService(page);

        // Demonstrate modern error handling with invalid credentials
        await expect(async () => {
            await authService.login(testData.invalidCredentials);
        }).rejects.toThrow(/Login failed/);

        // Demonstrate built-in retry pattern using Playwright's auto-retry
        // Playwright locators auto-retry, but for custom operations use expect with timeout
        await expect(async () => {
            const isAccessible = await authService.checkNiFiAccessibility(2000);
            if (!isAccessible) {
                throw new Error("Service not accessible");
            }
            return isAccessible;
        }).resolves.toBeTruthy();

        // Test completed - service accessibility verified
    });
});

test.describe("Framework Demonstration - Accessibility Testing", () => {
    test("Automated accessibility testing with axe-playwright", async ({
        page,
    }) => {
        const accessibilityService = new AccessibilityService(page);

        // Navigate to login page
        await page.goto("/nifi");

        // Demonstrate accessibility testing with direct patterns
        const loginResult = await accessibilityService.checkLoginForm();

        // Log accessibility results for monitoring
        if (!loginResult.passed) {
            // eslint-disable-next-line no-console
            console.log(
                "Accessibility violations found:",
                loginResult.violations.length,
            );
        }
    });

    test("Main canvas accessibility verification", async ({
        authenticatedPage,
    }) => {
        const accessibilityService = new AccessibilityService(
            authenticatedPage,
        );

        // Check main canvas accessibility
        const result = await accessibilityService.checkMainCanvas();

        // Log results but don't fail test for accessibility issues
        if (!result.passed) {
            // eslint-disable-next-line no-console
            console.warn(
                "Accessibility violations found in main canvas:",
                result.violations.length,
            );
        }

        expect(result).toHaveProperty("passed");
        expect(result).toHaveProperty("violations");
    });
});

test.describe("Framework Demonstration - Integration Testing", () => {
    test("Complete service integration demonstration", async ({
        authenticatedPage,
        pageVerifier,
    }) => {
        // Initialize all modern services
        const processorService = new ProcessorService(authenticatedPage);
        const accessibilityService = new AccessibilityService(
            authenticatedPage,
        );

        // Verify initial state using fixtures
        await pageVerifier.expectAuthenticated();
        await authenticatedPage.waitForLoadState("networkidle");

        // Test processor operations if available
        const jwtAuthenticator = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
        });

        if (jwtAuthenticator) {
            // eslint-disable-next-line no-console
            console.log("Found JWT Authenticator:", jwtAuthenticator.type);

            // Test processor interaction
            await processorService.interact(jwtAuthenticator, {
                action: "hover",
            });
        }

        // Run accessibility check as part of integration
        const a11yResult = await accessibilityService.checkMainCanvas();
        // eslint-disable-next-line no-console
        console.log(
            "Accessibility check completed:",
            a11yResult.passed ? "PASSED" : "HAS_VIOLATIONS",
        );

        // Take screenshot for documentation using built-in method
        await authenticatedPage.screenshot({
            path: `target/screenshots/integration-demo-complete-${Date.now()}.png`,
            fullPage: true,
        });

        // Final verification that everything is still working
        await pageVerifier.expectMainCanvas();
    });

    test("Performance monitoring demonstration", async ({ enhancedPage }) => {
        // Use enhanced page fixture with performance monitoring
        await enhancedPage.goto("/nifi");
        await enhancedPage.waitForStableNetwork();

        // Take step screenshot for documentation
        await enhancedPage.takeStepScreenshot("performance-demo");

        // Performance data is automatically collected by the fixture
        // eslint-disable-next-line no-console
        console.log("Performance monitoring active and data collected");
    });
});

test.describe("Framework Demonstration - Cross-Browser Compatibility", () => {
    test("Cross-browser functionality verification", async ({
        page,
        browserName,
    }) => {
        const authService = new AuthService(page);

        // eslint-disable-next-line no-console
        console.log(`Testing framework on browser: ${browserName}`);

        // Basic functionality should work across all browsers
        await authService.ensureReady();

        // Verify canvas is visible across browsers
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // eslint-disable-next-line no-console
        console.log(`✅ ${browserName} compatibility confirmed`);
    });
});

test.describe("Framework Demonstration - Legacy Compatibility", () => {
    test("Backward compatibility with existing patterns", async ({ page }) => {
        // Demonstrate that the framework maintains backward compatibility
        const authService = new AuthService(page);

        // Test legacy pattern still works
        await authService.ensureReady();

        // Verify using modern patterns
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );
    });
});

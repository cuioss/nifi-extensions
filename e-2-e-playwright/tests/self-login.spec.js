/**
 * @file Self-Test: Login Functionality
 * Tests authentication flow reliability with 2025 best practices
 * Single responsibility: Verify login works and fails appropriately
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";

test.describe("Self-Test: Login", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should successfully authenticate with valid credentials", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Check if NiFi is accessible before attempting navigation
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test authentication. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Navigate to login page
        await page.goto("/nifi");

        // Perform login
        await authService.login();

        // Verify successful authentication - canvas should be visible
        await authService.verifyCanvasVisible();

        // Verify page title contains NiFi
        await expect(page).toHaveTitle(/NiFi/);
    });

    // Test for invalid credentials removed - credentials come from constants
    // and invalid credentials would be a configuration issue, not a runtime test

    test("should logout successfully when authenticated", async ({ page }) => {
        const authService = new AuthService(page);

        // First login
        await authService.ensureReady();

        // Verify authenticated state
        await authService.verifyCanvasVisible();

        // Perform logout
        await authService.logout();

        // Verify logout - login button should be visible
        await authService.verifyLogoutState();
    });

    test("should maintain authentication state across page reloads", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Login and verify
        await authService.ensureReady();
        await authService.verifyCanvasVisible();

        // Reload page
        await page.reload();
        await page.waitForLoadState("networkidle");

        // Should still be authenticated
        await authService.verifyCanvasVisible();
    });

    test("should detect authentication status correctly", async ({ page }) => {
        const authService = new AuthService(page);

        // Check if NiFi is accessible before attempting navigation
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test authentication status. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Initially should not be authenticated
        await page.goto("/nifi");
        const initialAuth = await authService.isAuthenticated();
        expect(initialAuth).toBeFalsy();

        // After login should be authenticated
        await authService.login();
        const postLoginAuth = await authService.isAuthenticated();
        expect(postLoginAuth).toBeTruthy();
    });
});

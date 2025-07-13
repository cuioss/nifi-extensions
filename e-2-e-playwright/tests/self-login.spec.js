/**
 * @file Self-Test: Login Functionality
 * Tests authentication flow reliability with 2025 best practices
 * Single responsibility: Verify login works and fails appropriately
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Self-Test: Login", () => {
    test("should successfully authenticate with valid credentials", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Navigate to login page
        await page.goto("/nifi");

        // Perform login
        await authService.login();

        // Verify successful authentication - canvas should be visible
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 15000 },
        );

        // Verify page title contains NiFi
        await expect(page).toHaveTitle(/NiFi/);
    });

    test("should reject invalid credentials", async ({ page }) => {
        const authService = new AuthService(page);

        // Navigate to login page
        await page.goto("/nifi");

        // Attempt login with invalid credentials - should fail
        await expect(async () => {
            await authService.login({
                username: "invalid",
                password: "wrongpassword",
            });
        }).rejects.toThrow(/Login failed/);

        // Should still be on login page
        const loginButton = page.getByRole("button", { name: /log in|login/i });
        await expect(loginButton).toBeVisible();
    });

    test("should logout successfully when authenticated", async ({ page }) => {
        const authService = new AuthService(page);

        // First login
        await authService.ensureReady();

        // Verify authenticated state
        await expect(
            page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();

        // Perform logout
        await authService.logout();

        // Verify logout - login button should be visible
        const loginButton = page.getByRole("button", { name: /log in|login/i });
        await expect(loginButton).toBeVisible({ timeout: 10000 });
    });

    test("should maintain authentication state across page reloads", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Login and verify
        await authService.ensureReady();
        await expect(
            page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();

        // Reload page
        await page.reload();
        await page.waitForLoadState("networkidle");

        // Should still be authenticated
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 15000 },
        );
    });

    test("should detect authentication status correctly", async ({ page }) => {
        const authService = new AuthService(page);

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

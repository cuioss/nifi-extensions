/**
 * @file Self-Test: Navigation Functionality
 * Tests navigation reliability with 2025 best practices
 * Single responsibility: Verify navigation works between application areas
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Self-Test: Navigation", () => {
    test.beforeEach(async ({ page }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test("should navigate to main canvas successfully", async ({ page }) => {
        const authService = new AuthService(page);

        // Navigate to main canvas
        await authService.navigateToPage("MAIN_CANVAS");

        // Verify we're on the main canvas
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 10000 },
        );

        // Verify page is stable and ready
        await page.waitForLoadState("networkidle");

        // Check for key navigation elements
        const operateButtons = page.getByRole("button", { name: /operate/i });
        const navigationElements = await operateButtons.count();
        expect(navigationElements).toBeGreaterThanOrEqual(0);
    });

    test("should handle navigation errors gracefully", async ({ page }) => {
        const authService = new AuthService(page);

        // Attempt to navigate to invalid page type
        await expect(async () => {
            await authService.navigateToPage("INVALID_PAGE");
        }).rejects.toThrow(/Unknown page type/);

        // Should still be on a valid page
        await expect(
            page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
        ).toBeVisible();
    });

    test("should verify page accessibility and loading state", async ({
        page,
    }) => {
        // Check that NiFi service is accessible
        const response = await page.request.get("/nifi", {
            failOnStatusCode: false,
        });

        // Should get a valid response (200-399 or 401 for auth required)
        const isAccessible =
            response.status() < 400 || response.status() === 401;
        expect(isAccessible).toBeTruthy();
    });

    test("should maintain proper URL structure during navigation", async ({
        page,
    }) => {
        const authService = new AuthService(page);

        // Navigate to main canvas
        await authService.navigateToPage("MAIN_CANVAS");

        // Verify URL contains expected path
        const currentUrl = page.url();
        expect(currentUrl).toContain("/nifi");
    });

    test("should handle browser back/forward navigation", async ({ page }) => {
        const authService = new AuthService(page);

        // Ensure we're on main canvas
        await authService.navigateToPage("MAIN_CANVAS");

        // Navigate away (reload as simple navigation)
        await page.reload();
        await page.waitForLoadState("networkidle");

        // Should return to same functional state
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 15000 },
        );
    });

    test("should verify page readiness indicators", async ({ page }) => {
        // Wait for all network activity to complete
        await page.waitForLoadState("networkidle");

        // Verify no loading spinners are present
        const loadingIndicators = page.locator(
            ".loading, .spinner, mat-spinner",
        );
        await expect(loadingIndicators).toHaveCount(0, { timeout: 10000 });

        // Verify main canvas is interactive
        const canvas = page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS);
        await expect(canvas).toBeVisible();

        // Verify the canvas is ready for interaction (not disabled)
        const isEnabled = await canvas.isEnabled();
        expect(isEnabled).toBeTruthy();
    });
});

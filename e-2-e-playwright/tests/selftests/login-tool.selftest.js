/**
 * @file Login Tool Selftest
 * Tests the login tool functionality
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { login, logout, ensureNiFiReady } from "../../utils/login-tool";
import { PAGE_TYPES } from "../../utils/constants";
import { getPageContext } from "../../utils/test-helper";

test.describe("Login Tool Tests", () => {
    test("ensureNiFiReady should prepare NiFi for testing", async ({
        page,
    }) => {
        // Test that ensureNiFiReady works correctly
        await ensureNiFiReady(page);

        // Verify we're on the main canvas and authenticated
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isAuthenticated).toBeTruthy();
        expect(context.isReady).toBeTruthy();
    });

    test("login should authenticate user", async ({ page }) => {
        // Navigate to login page first
        await page.goto("/#/login");

        // Test that login works correctly
        await login(page);

        // Verify we're on the main canvas and authenticated
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isAuthenticated).toBeTruthy();
    });

    test("logout should clear session", async ({
        page,
        context: browserContext,
    }) => {
        // Ensure we're logged in first
        await ensureNiFiReady(page);

        // Test that logout works correctly
        await logout(page, browserContext);

        // Verify we're on the login page and not authenticated
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.LOGIN);
        expect(context.isAuthenticated).toBeFalsy();
    });

    test("login should fail with invalid credentials", async ({ page }) => {
        // Navigate to login page first
        await page.goto("/#/login");

        // Test that login fails with invalid credentials
        try {
            await login(page, { username: "invalid", password: "invalid" });
            // If we get here, the test failed
            expect(
                false,
                "Login should have failed with invalid credentials",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Login failed");
        }
    });

    test("ensureNiFiReady should handle already authenticated state", async ({
        page,
    }) => {
        // Ensure we're logged in first
        await ensureNiFiReady(page);

        // Test that ensureNiFiReady works correctly when already authenticated
        await ensureNiFiReady(page);

        // Verify we're still on the main canvas and authenticated
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isAuthenticated).toBeTruthy();
        expect(context.isReady).toBeTruthy();
    });
});

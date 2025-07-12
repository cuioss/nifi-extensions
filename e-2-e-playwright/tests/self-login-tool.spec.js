/**
 * @file Login Tool and NiFi Authentication Tests
 * Tests the login tool functionality and NiFi authentication
 * Merged from self-login-tool.spec.js and 01-nifi-authentication.spec.js
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";
import { login, logout, ensureNiFiReady } from "../utils/login-tool";
import { PAGE_TYPES } from "../utils/constants";
import { testSetup, getPageContext } from "../utils/test-helper";
import { navigateToPage } from "../utils/navigation-tool";

test.describe("Login Tool and NiFi Authentication Tests", () => {
    test("ensureNiFiReady should prepare NiFi for testing", async ({
        page,
    }) => {
        testSetup("Testing NiFi preparation for testing");

        // Test that ensureNiFiReady works correctly
        await ensureNiFiReady(page);

        // Verify we're on the main canvas and authenticated
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isAuthenticated).toBeTruthy();
        expect(context.isReady).toBeTruthy();
    });

    test("login should authenticate user and maintain session", async ({
        page,
    }) => {
        testSetup("Testing login functionality and session maintenance");

        // Navigate to login page using navigation tool
        await navigateToPage(page, PAGE_TYPES.LOGIN);

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
        testSetup("Testing logout functionality");

        // Ensure we're logged in first
        await ensureNiFiReady(page);

        // Verify we're authenticated before logout
        const pageContext = await getPageContext(page);
        expect(pageContext.isAuthenticated).toBeTruthy();
        expect(pageContext.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);

        // Test that logout works correctly
        await logout(page, browserContext);

        // Verify we're on the login page and not authenticated
        const newContext = await getPageContext(page);
        expect(newContext.pageType).toBe(PAGE_TYPES.LOGIN);
        expect(newContext.isAuthenticated).toBeFalsy();
    });

    test("login should reject invalid credentials", async ({ page }) => {
        testSetup("Testing invalid credentials rejection");

        // Navigate to login page using navigation tool
        await navigateToPage(page, PAGE_TYPES.LOGIN);

        // Test that login fails with invalid credentials
        try {
            await login(page, {
                username: "invalid-user",
                password: "invalid-password",
            });
            // If we get here, the test failed
            expect(
                false,
                "Login should have failed with invalid credentials",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Login failed");
        }

        // Verify we're still on the login page
        const context = await getPageContext(page);
        expect(context.isAuthenticated).toBeFalsy();
        expect(context.pageType).toBe(PAGE_TYPES.LOGIN);
    });

    test("ensureNiFiReady should handle already authenticated state", async ({
        page,
    }) => {
        testSetup("Testing NiFi preparation when already authenticated");

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

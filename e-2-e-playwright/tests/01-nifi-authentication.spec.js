/**
 * @file NiFi Authentication Tests
 * Simplified authentication tests focused on reliable login for processor testing
 * Adapted from e-2-e-cypress/cypress/e2e/01-nifi-authentication.cy.js
 */

import { test, expect } from "@playwright/test";
import { PAGE_TYPES } from "../utils/constants.js";
import { testSetup, getPageContext } from "../utils/test-helper.js";
import { login, logout, ensureNiFiReady } from "../utils/login-tool.js";
import { navigateToPage } from "../utils/navigation-tool.js";

test.describe("NiFi Authentication", () => {
    test("Should login successfully and maintain session", async ({ page }) => {
        testSetup("Testing reliable NiFi login for processor testing");

        // Navigate to login page
        await navigateToPage(page, PAGE_TYPES.LOGIN);

        // Login using login tool with default credentials
        await login(page);

        // Verify we're authenticated and on the main canvas
        const context = await getPageContext(page);
        expect(context.isAuthenticated).toBeTruthy();
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
    });

    test("Should reject invalid credentials", async ({ page }) => {
        testSetup("Testing invalid credentials rejection");

        // Navigate to login page
        await navigateToPage(page, PAGE_TYPES.LOGIN);

        // Test with invalid credentials
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

    test("Should logout and clear session", async ({
        page,
        context: browserContext,
    }) => {
        testSetup("Testing logout functionality");

        // First ensure we're logged in
        await ensureNiFiReady(page);

        // Verify we're authenticated before logout
        const pageContext = await getPageContext(page);
        expect(pageContext.isAuthenticated).toBeTruthy();
        expect(pageContext.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);

        // Logout using logout tool
        await logout(page, browserContext);

        // Verify we're logged out
        const newContext = await getPageContext(page);
        expect(newContext.isAuthenticated).toBeFalsy();
        expect(newContext.pageType).toBe(PAGE_TYPES.LOGIN);
    });
});

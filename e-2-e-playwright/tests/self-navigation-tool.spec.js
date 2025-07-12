/**
 * @file Navigation Tool Tests
 * Tests the navigation tool functionality
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import {
    navigateToPage,
    verifyPageType,
    waitForPageType,
} from "../utils/navigation-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { PAGE_TYPES } from "../utils/constants";
import { getPageContext } from "../utils/test-helper";

test.describe("Navigation Tool Tests", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    test("navigateToPage should navigate to the specified page", async ({
        page,
    }) => {
        // Test navigation to main canvas
        await navigateToPage(page, PAGE_TYPES.MAIN_CANVAS);

        // Verify we're on the main canvas
        const context = await getPageContext(page);
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isReady).toBeTruthy();
    });

    test("verifyPageType should verify the current page type", async ({
        page,
    }) => {
        // Navigate to main canvas
        await navigateToPage(page, PAGE_TYPES.MAIN_CANVAS);

        // Test that verifyPageType works correctly
        const context = await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS);

        // Verify the context
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isReady).toBeTruthy();
    });

    test("verifyPageType should fail with incorrect page type", async ({
        page,
    }) => {
        // Navigate to main canvas
        await navigateToPage(page, PAGE_TYPES.MAIN_CANVAS);

        // Test that verifyPageType fails with incorrect page type
        try {
            await verifyPageType(page, PAGE_TYPES.LOGIN);
            // If we get here, the test failed
            expect(
                false,
                "verifyPageType should have failed with incorrect page type",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain(
                `Expected ${PAGE_TYPES.LOGIN}, got ${PAGE_TYPES.MAIN_CANVAS}`,
            );
        }
    });

    test("waitForPageType should wait for the specified page type", async ({
        page,
    }) => {
        // Navigate to main canvas
        await navigateToPage(page, PAGE_TYPES.MAIN_CANVAS);

        // Test that waitForPageType works correctly
        const context = await waitForPageType(page, PAGE_TYPES.MAIN_CANVAS);

        // Verify the context
        expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
        expect(context.isReady).toBeTruthy();
    });

    test("waitForPageType should timeout with incorrect page type", async ({
        page,
    }) => {
        // Navigate to main canvas
        await navigateToPage(page, PAGE_TYPES.MAIN_CANVAS);

        // Test that waitForPageType times out with incorrect page type
        try {
            await waitForPageType(page, PAGE_TYPES.LOGIN, { timeout: 2000 });
            // If we get here, the test failed
            expect(
                false,
                "waitForPageType should have timed out with incorrect page type",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Timeout waiting for page type");
        }
    });

    test("navigateToPage should fail with unknown page type", async ({
        page,
    }) => {
        // Test that navigateToPage fails with unknown page type
        try {
            await navigateToPage(page, "UNKNOWN_PAGE_TYPE");
            // If we get here, the test failed
            expect(
                false,
                "navigateToPage should have failed with unknown page type",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Unknown page type");
        }
    });
});

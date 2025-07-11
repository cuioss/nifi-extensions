/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import {
    verifyMultiIssuerJwtAuthenticatorDeployment,
    findMultiIssuerJwtAuthenticator,
    openProcessorAdvancedConfiguration,
    openProcessorConfigureDialog,
} from "../utils/processor-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { PAGE_TYPES } from "../utils/constants";
import { verifyPageType } from "../utils/navigation-tool";
import { logMessage } from "../utils/login-tool";

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    test("should verify login and processor deployment", async ({ page }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Verify processor deployment
        const verification =
            await verifyMultiIssuerJwtAuthenticatorDeployment(page);

        // Verify processor deployment results
        expect(
            verification.found,
            "MultiIssuerJWTTokenAuthenticator processor should be found",
        ).toBeTruthy();
        expect(
            verification.visible,
            "MultiIssuerJWTTokenAuthenticator processor should be visible",
        ).toBeTruthy();
        expect(
            verification.details.name,
            "Processor name should contain expected text",
        ).toContain("MultiIssuerJWTTokenAuthenticator");
    });

    test("should open advanced configuration for MultiIssuerJWTTokenAuthenticator", async ({
        page,
    }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Find the processor
        const processor = await findMultiIssuerJwtAuthenticator(page);
        expect(
            processor,
            "MultiIssuerJWTTokenAuthenticator processor should be found",
        ).toBeTruthy();

        // Open advanced configuration using the utility function
        const result = await openProcessorAdvancedConfiguration(
            page,
            processor,
            {
                takeScreenshot: true,
                closeDialog: true,
                timeout: 5000, // Increase timeout to 5 seconds
            },
        );

        // Verify the result
        expect(
            result.success,
            "Advanced configuration should open successfully",
        ).toBeTruthy();
        expect(
            result.propertyLabels.length,
            "Should find property labels",
        ).toBeGreaterThan(0);

        // Log the property labels for debugging
        logMessage(
            "info",
            `Found property labels: ${result.propertyLabels.join(", ")}`,
        );
    });

    test("should open configure dialog for MultiIssuerJWTTokenAuthenticator", async ({
        page,
    }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Find the processor
        const processor = await findMultiIssuerJwtAuthenticator(page);
        expect(
            processor,
            "MultiIssuerJWTTokenAuthenticator processor should be found",
        ).toBeTruthy();

        // Open configuration dialog using the utility function
        const result = await openProcessorConfigureDialog(page, processor, {
            takeScreenshot: true,
            closeDialog: true,
            clickPropertiesTab: true,
            timeout: 5000, // Increase timeout to 5 seconds
        });

        // Verify the result
        expect(
            result.success,
            "Configuration dialog should open successfully",
        ).toBeTruthy();
        expect(
            result.propertyLabels.length,
            "Should find property labels",
        ).toBeGreaterThan(0);

        // Log the property labels for debugging
        logMessage(
            "info",
            `Found property labels in configuration dialog: ${result.propertyLabels.join(", ")}`,
        );
    });

    test("should verify the result of advanced configuration", async ({
        page,
    }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Find the processor
        const processor = await findMultiIssuerJwtAuthenticator(page);
        expect(
            processor,
            "MultiIssuerJWTTokenAuthenticator processor should be found",
        ).toBeTruthy();

        // Verify processor properties
        expect(processor.isVisible, "Processor should be visible").toBeTruthy();
        expect(
            processor.name,
            "Processor name should contain expected text",
        ).toContain("MultiIssuerJWTTokenAuthenticator");

        // Log processor details for verification
        logMessage("info", "Processor verification complete");
        logMessage(
            "info",
            `Processor details: Name=${processor.name}, ID=${processor.id || "N/A"}`,
        );

        // Take a screenshot of the processor on the canvas
        await page.screenshot({
            path: "target/screenshots/processor-on-canvas.png",
        });
    });
});

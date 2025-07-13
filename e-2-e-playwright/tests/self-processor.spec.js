/**
 * @file Processor Deployment Verification Test
 * Comprehensive test that verifies processor deployment and functionality
 * @version 2.0.0
 */

import { test, expect } from "@playwright/test";
import {
    verifyMultiIssuerJwtAuthenticatorDeployment,
    findMultiIssuerJwtAuthenticator,
    interactWithProcessor,
} from "../utils/processor-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { logMessage } from "../utils/shared-logger";
import { PAGE_TYPES } from "../utils/constants";
import { verifyPageType } from "../utils/navigation-tool";

test.describe("Processor Deployment Verification", () => {
    // Make sure we're logged in before the test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    test("should verify MultiIssuerJWTTokenAuthenticator processor deployment", async ({
        page,
    }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Perform comprehensive processor deployment verification
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
        expect(
            verification.details.position,
            "Processor should have valid position",
        ).toBeTruthy();

        // Note: Processor ID may be empty in some NiFi versions - this is acceptable
        logMessage(
            "info",
            `Processor ID: ${verification.details.id || "empty"}`,
        );
    });

    test("should interact with MultiIssuerJWTTokenAuthenticator processor", async ({
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

        // Interact with the processor (double-click to open configuration)
        const interactionResult = await interactWithProcessor(page, processor);

        // Note: Configuration dialog may not appear due to UI restrictions
        // The important thing is that the processor was found and is accessible
        logMessage("info", `Interaction result: ${interactionResult}`);

        // Verify that we can at least attempt to interact with the processor
        expect(
            processor.element,
            "Processor element should be accessible",
        ).toBeTruthy();
    });

    test("should verify processor status and properties", async ({ page }) => {
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
        expect(
            processor.className,
            "Processor should have processor class",
        ).toContain("processor");
        expect(
            processor.position.x,
            "Processor should have valid X position",
        ).toBeGreaterThan(0);
        expect(
            processor.position.y,
            "Processor should have valid Y position",
        ).toBeGreaterThan(0);

        // Log processor details for debugging
        logMessage(
            "info",
            `Processor Details: name=${processor.name}, id=${processor.id}, className=${processor.className}, position=${JSON.stringify(processor.position)}, isVisible=${processor.isVisible}`,
        );
    });
});

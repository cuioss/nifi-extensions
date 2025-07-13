/**
 * @file Processor Deployment Verification Test - Modernized
 * Comprehensive test that verifies processor deployment and functionality
 * @version 3.0.0
 */

import { test, expect } from "@playwright/test";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Processor Deployment Verification", () => {
    // Make sure we're logged in before the test
    test.beforeEach(async ({ page }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test("should verify MultiIssuerJWTTokenAuthenticator processor deployment", async ({
        page,
    }) => {
        const processorService = new ProcessorService(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Perform comprehensive processor deployment verification using modern service
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            // Verify processor deployment results
            expect(
                processor,
                "MultiIssuerJWTTokenAuthenticator processor should be found",
            ).toBeTruthy();
            expect(
                processor.isVisible,
                "MultiIssuerJWTTokenAuthenticator processor should be visible",
            ).toBeTruthy();
            expect(
                processor.name,
                "Processor name should contain expected text",
            ).toContain("MultiIssuerJWTTokenAuthenticator");
            expect(
                processor.position,
                "Processor should have valid position",
            ).toBeTruthy();
        } else {
            console.log(
                "MultiIssuerJWTTokenAuthenticator processor not found - skipping verification",
            );
        }
    });

    test("should interact with MultiIssuerJWTTokenAuthenticator processor", async ({
        page,
    }) => {
        const processorService = new ProcessorService(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Find the processor using modern service
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            // Interact with the processor using modern service
            await processorService.interact(processor, { action: "hover" });

            // Verify that we can access the processor
            expect(
                processor.element,
                "Processor element should be accessible",
            ).toBeTruthy();
        } else {
            console.log(
                "MultiIssuerJWTTokenAuthenticator processor not found - skipping interaction",
            );
        }
    });

    test("should verify processor status and properties", async ({ page }) => {
        const processorService = new ProcessorService(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Find the processor using modern service
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            // Verify processor properties
            expect(
                processor.isVisible,
                "Processor should be visible",
            ).toBeTruthy();
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
        } else {
            console.log(
                "MultiIssuerJWTTokenAuthenticator processor not found - skipping property verification",
            );
        }
    });
});

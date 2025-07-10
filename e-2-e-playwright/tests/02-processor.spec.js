/**
 * @file Processor Tests
 * Tests for processor operations in NiFi
 * Includes standard login and navigation to the main canvas
 * Adapted from e-2-e-cypress/cypress/e2e/processor.cy.js
 */

import { test, expect } from "@playwright/test";
import { PAGE_TYPES, PAGE_DEFINITIONS } from "../utils/constants.js";
import { testSetup } from "../utils/test-helper.js";
import { ensureNiFiReady } from "../utils/login-tool.js";
import { verifyPageType } from "../utils/navigation-tool.js";
import path from "path";

// Define paths for screenshots (following Maven standard)
const TARGET_DIR = path.join(__dirname, "..", "target");
const SCREENSHOTS_DIR = path.join(TARGET_DIR, "screenshots");

// Ensure the screenshots directory exists
const fs = require("fs");
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Define a fixture for ensuring NiFi is ready before each test
test.beforeEach(async ({ page }) => {
    // Ensure NiFi is ready for testing
    await ensureNiFiReady(page);
});

test.describe("Processor Tests", () => {
    test("Should login and navigate to the main canvas", async ({ page }) => {
        testSetup("Testing canvas readiness for processor operations");

        // Verify the canvas is ready for operations
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Take a screenshot of the ready canvas
        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "canvas-ready.png"),
        });

        // Log success message
        // eslint-disable-next-line no-console
        console.log("✅ Canvas is ready for operations");
    });

    test("Should display processor toolbar", async ({ page }) => {
        testSetup("Testing processor toolbar visibility");

        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Check if the toolbar is visible
        const toolbar = await page.$(
            PAGE_DEFINITIONS[PAGE_TYPES.MAIN_CANVAS].elements[0],
        );
        expect(toolbar, "Toolbar should be visible").toBeTruthy();

        // Take a screenshot of the toolbar
        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "processor-toolbar.png"),
        });
    });

    test("Should open processor dialog", async ({ page }) => {
        testSetup("Testing processor dialog");

        // This is a placeholder test that would need to be implemented
        // based on how you interact with the NiFi UI to add processors

        // In a real implementation, you would:
        // 1. Click the "Add Processor" button
        // 2. Wait for the processor dialog to appear
        // 3. Verify the dialog is visible
        // 4. Search for a specific processor type
        // 5. Select the processor
        // 6. Verify the processor is added to the canvas

        // For now, we'll just verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Log a message indicating this is a placeholder
        // eslint-disable-next-line no-console
        console.log(
            "⚠️ This is a placeholder test for processor dialog interaction",
        );
    });
});

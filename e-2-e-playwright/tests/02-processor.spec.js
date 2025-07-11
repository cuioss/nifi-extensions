/**
 * @file Processor Tests
 * Tests for processor operations in NiFi
 * Includes standard login and navigation to the main canvas
 * Adapted from e-2-e-cypress/cypress/e2e/processor.cy.js
 */

import { test, expect } from "@playwright/test";
import {
    PAGE_TYPES,
    PAGE_DEFINITIONS,
    PROCESSOR_TYPES,
} from "../utils/constants.js";
import { testSetup } from "../utils/test-helper.js";
import { ensureNiFiReady } from "../utils/login-tool.js";
import { verifyPageType } from "../utils/navigation-tool.js";
import {
    addJwtTokenAuthenticator,
    addMultiIssuerJwtAuthenticator,
    removeJwtTokenAuthenticator,
    removeMultiIssuerJwtAuthenticator,
    checkJwtProcessorExists,
} from "../utils/jwt-processor-tool.js";
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

    test("Should add and remove JWT Token Authenticator processor", async ({
        page,
    }) => {
        testSetup("Testing JWT Token Authenticator processor operations");

        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Step 1: Verify processor doesn't exist initially (fail-fast if detection doesn't work)
        const initialExists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        if (initialExists) {
            // If processor exists, remove it first to ensure clean state
            await removeJwtTokenAuthenticator(page);

            // Verify removal was successful
            const stillExists = await checkJwtProcessorExists(
                page,
                PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
            );
            expect(
                stillExists,
                "Processor should be removed for clean test state",
            ).toBeFalsy();
        }

        // Step 2: Add the JWT Token Authenticator processor
        const processor = await addJwtTokenAuthenticator(page);

        // Step 3: Verify processor was added successfully
        expect(
            processor,
            "JWT Token Authenticator should be added",
        ).toBeTruthy();
        expect(processor.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
        expect(processor.isVisible).toBeTruthy();

        // Step 4: Check if the processor exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(
            exists,
            "JWT Token Authenticator should exist on canvas",
        ).toBeTruthy();

        // Step 5: Remove the processor
        const removeSuccess = await removeJwtTokenAuthenticator(page);
        expect(
            removeSuccess,
            "JWT Token Authenticator should be removed",
        ).toBeTruthy();

        // Step 6: Verify processor was removed
        const removedExists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(
            removedExists,
            "JWT Token Authenticator should not exist after removal",
        ).toBeFalsy();
    });

    test("Should add and remove Multi-Issuer JWT Authenticator processor", async ({
        page,
    }) => {
        testSetup(
            "Testing Multi-Issuer JWT Authenticator processor operations",
        );

        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Step 1: Verify processor doesn't exist initially (fail-fast if detection doesn't work)
        const initialExists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        if (initialExists) {
            // If processor exists, remove it first to ensure clean state
            await removeMultiIssuerJwtAuthenticator(page);

            // Verify removal was successful
            const stillExists = await checkJwtProcessorExists(
                page,
                PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
            );
            expect(
                stillExists,
                "Processor should be removed for clean test state",
            ).toBeFalsy();
        }

        // Step 2: Add the Multi-Issuer JWT Authenticator processor
        const processor = await addMultiIssuerJwtAuthenticator(page);

        // Step 3: Verify processor was added successfully
        expect(
            processor,
            "Multi-Issuer JWT Authenticator should be added",
        ).toBeTruthy();
        expect(processor.type).toBe(
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(processor.isVisible).toBeTruthy();

        // Step 4: Check if the processor exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(
            exists,
            "Multi-Issuer JWT Authenticator should exist on canvas",
        ).toBeTruthy();

        // Step 5: Remove the processor
        const removeSuccess = await removeMultiIssuerJwtAuthenticator(page);
        expect(
            removeSuccess,
            "Multi-Issuer JWT Authenticator should be removed",
        ).toBeTruthy();

        // Step 6: Verify processor was removed
        const removedExists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(
            removedExists,
            "Multi-Issuer JWT Authenticator should not exist after removal",
        ).toBeFalsy();
    });
});

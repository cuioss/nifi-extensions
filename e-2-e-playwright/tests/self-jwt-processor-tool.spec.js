/**
 * @file JWT Processor Tool Tests
 * Tests the JWT processor tool functionality and JWT processor operations
 * Merged from self-jwt-processor-tool.spec.js and 02-processor.spec.js
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";
import {
    checkJwtProcessorExists,
    addJwtTokenAuthenticator,
    addMultiIssuerJwtAuthenticator,
    removeJwtTokenAuthenticator,
    removeMultiIssuerJwtAuthenticator,
} from "../utils/jwt-processor-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { PROCESSOR_TYPES, PAGE_TYPES } from "../utils/constants";
import { testSetup } from "../utils/test-helper";
import { verifyPageType } from "../utils/navigation-tool";
import path from "path";

// Define paths for screenshots (following Maven standard)
const TARGET_DIR = path.join(__dirname, "..", "target");
const SCREENSHOTS_DIR = path.join(TARGET_DIR, "screenshots");

// Ensure the screenshots directory exists
const fs = require("fs");
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe("JWT Processor Tool Tests", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    test("should add and remove JWT Token Authenticator processor with comprehensive steps", async ({
        page,
    }) => {
        testSetup(
            "Testing comprehensive JWT Token Authenticator processor operations",
        );

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

        // Take a screenshot of the processor
        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "jwt-token-authenticator.png"),
        });

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

    test("should add and remove Multi-Issuer JWT Authenticator processor with comprehensive steps", async ({
        page,
    }) => {
        testSetup(
            "Testing comprehensive Multi-Issuer JWT Authenticator processor operations",
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

        // Take a screenshot of the processor
        await page.screenshot({
            path: path.join(
                SCREENSHOTS_DIR,
                "multi-issuer-jwt-authenticator.png",
            ),
        });

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

    // Clean up after each test to ensure a clean canvas
    test.afterEach(async ({ page }) => {
        // Try to remove JWT Token Authenticator if it exists
        try {
            await removeJwtTokenAuthenticator(page);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(
                `Cleanup error for JWT Token Authenticator: ${error.message}`,
            );
        }

        // Try to remove Multi-Issuer JWT Token Authenticator if it exists
        try {
            await removeMultiIssuerJwtAuthenticator(page);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(
                `Cleanup error for Multi-Issuer JWT Token Authenticator: ${error.message}`,
            );
        }
    });

    test("checkJwtProcessorExists should detect JWT Token Authenticator", async ({
        page,
    }) => {
        // First add a processor to check
        await addJwtTokenAuthenticator(page);

        // Test that checkJwtProcessorExists works correctly
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );

        // Verify the processor was detected
        expect(exists).toBeTruthy();
    });

    test("checkJwtProcessorExists should detect Multi-Issuer JWT Authenticator", async ({
        page,
    }) => {
        // First add a processor to check
        await addMultiIssuerJwtAuthenticator(page);

        // Test that checkJwtProcessorExists works correctly
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );

        // Verify the processor was detected
        expect(exists).toBeTruthy();
    });

    test("checkJwtProcessorExists should return false for non-existent processor", async ({
        page,
    }) => {
        // Make sure the processor doesn't exist
        await removeJwtTokenAuthenticator(page);

        // Test that checkJwtProcessorExists returns false for a non-existent processor
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );

        // Verify the processor was not detected
        expect(exists).toBeFalsy();
    });

    test("checkJwtProcessorExists should fail with failIfNotFound option", async ({
        page,
    }) => {
        // Make sure the processor doesn't exist
        await removeJwtTokenAuthenticator(page);

        // Test that checkJwtProcessorExists fails with failIfNotFound option
        try {
            await checkJwtProcessorExists(
                page,
                PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
                { failIfNotFound: true },
            );
            // If we get here, the test failed
            expect(
                false,
                "checkJwtProcessorExists should have failed with failIfNotFound option",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Processor not found");
        }
    });

    test("addJwtTokenAuthenticator should add a JWT Token Authenticator", async ({
        page,
    }) => {
        // Test that addJwtTokenAuthenticator works correctly
        const processor = await addJwtTokenAuthenticator(page);

        // Verify the processor was added
        expect(processor).toBeTruthy();
        expect(processor.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
        expect(processor.isVisible).toBeTruthy();

        // Verify the processor exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(exists).toBeTruthy();
    });

    test("addMultiIssuerJwtAuthenticator should add a Multi-Issuer JWT Authenticator", async ({
        page,
    }) => {
        // Test that addMultiIssuerJwtAuthenticator works correctly
        const processor = await addMultiIssuerJwtAuthenticator(page);

        // Verify the processor was added
        expect(processor).toBeTruthy();
        expect(processor.type).toBe(
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(processor.isVisible).toBeTruthy();

        // Verify the processor exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(exists).toBeTruthy();
    });

    test("removeJwtTokenAuthenticator should remove a JWT Token Authenticator", async ({
        page,
    }) => {
        // First add a processor to remove
        await addJwtTokenAuthenticator(page);

        // Test that removeJwtTokenAuthenticator works correctly
        const success = await removeJwtTokenAuthenticator(page);

        // Verify the processor was removed
        expect(success).toBeTruthy();

        // Verify the processor no longer exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(exists).toBeFalsy();
    });

    test("removeMultiIssuerJwtAuthenticator should remove a Multi-Issuer JWT Authenticator", async ({
        page,
    }) => {
        // First add a processor to remove
        await addMultiIssuerJwtAuthenticator(page);

        // Test that removeMultiIssuerJwtAuthenticator works correctly
        const success = await removeMultiIssuerJwtAuthenticator(page);

        // Verify the processor was removed
        expect(success).toBeTruthy();

        // Verify the processor no longer exists on the canvas
        const exists = await checkJwtProcessorExists(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(exists).toBeFalsy();
    });

    test("removeJwtTokenAuthenticator should not fail if processor doesn't exist", async ({
        page,
    }) => {
        // Make sure the processor doesn't exist
        await removeJwtTokenAuthenticator(page);

        // Test that removeJwtTokenAuthenticator doesn't fail if processor doesn't exist
        const success = await removeJwtTokenAuthenticator(page);

        // Verify the operation was successful
        expect(success).toBeTruthy();
    });

    test("removeMultiIssuerJwtAuthenticator should not fail if processor doesn't exist", async ({
        page,
    }) => {
        // Make sure the processor doesn't exist
        await removeMultiIssuerJwtAuthenticator(page);

        // Test that removeMultiIssuerJwtAuthenticator doesn't fail if processor doesn't exist
        const success = await removeMultiIssuerJwtAuthenticator(page);

        // Verify the operation was successful
        expect(success).toBeTruthy();
    });

    test("addJwtTokenAuthenticator should skip if processor already exists", async ({
        page,
    }) => {
        // First add a processor
        await addJwtTokenAuthenticator(page);

        // Add the same processor again with skipIfExists=true
        const processor2 = await addJwtTokenAuthenticator(page);

        // Verify the second call returned the existing processor
        expect(processor2).toBeTruthy();
        expect(processor2.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);

        // Verify only one processor exists on the canvas
        const foundProcessors = await page.$$(
            `text=${PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR}`,
        );
        expect(foundProcessors.length).toBe(1);
    });

    test("addMultiIssuerJwtAuthenticator should skip if processor already exists", async ({
        page,
    }) => {
        // First add a processor
        await addMultiIssuerJwtAuthenticator(page);

        // Add the same processor again with skipIfExists=true
        const processor2 = await addMultiIssuerJwtAuthenticator(page);

        // Verify the second call returned the existing processor
        expect(processor2).toBeTruthy();
        expect(processor2.type).toBe(
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );

        // Verify only one processor exists on the canvas
        const foundProcessors = await page.$$(
            `text=${PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR}`,
        );
        expect(foundProcessors.length).toBe(1);
    });
});

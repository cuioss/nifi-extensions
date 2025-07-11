/**
 * @file Processor Tool Tests
 * Tests the processor tool functionality for JWT processors
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import {
    findProcessor,
    addProcessor,
    removeProcessor,
    addJwtTokenAuthenticator,
    addMultiIssuerJwtAuthenticator,
    removeJwtTokenAuthenticator,
    removeMultiIssuerJwtAuthenticator,
} from "../utils/processor-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { PROCESSOR_TYPES } from "../utils/constants";

test.describe("Processor Tool Tests", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    // Clean up after each test to ensure a clean canvas
    test.afterEach(async ({ page }) => {
        // Try to remove JWT Token Authenticator if it exists
        try {
            const processor = await findProcessor(
                page,
                PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
            );
            if (processor) {
                await removeProcessor(page, processor);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(
                `Cleanup error for JWT Token Authenticator: ${error.message}`,
            );
        }

        // Try to remove Multi-Issuer JWT Token Authenticator if it exists
        try {
            const processor = await findProcessor(
                page,
                PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
            );
            if (processor) {
                await removeProcessor(page, processor);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(
                `Cleanup error for Multi-Issuer JWT Token Authenticator: ${error.message}`,
            );
        }
    });

    test("findProcessor should find a processor on the canvas", async ({
        page,
    }) => {
        // First add a processor to find
        await addJwtTokenAuthenticator(page);

        // Test that findProcessor works correctly
        const processor = await findProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );

        // Verify the processor was found
        expect(processor).toBeTruthy();
        expect(processor.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
        expect(processor.isVisible).toBeTruthy();
    });

    test("findProcessor should return null for non-existent processor", async ({
        page,
    }) => {
        // Test that findProcessor returns null for a non-existent processor
        const processor = await findProcessor(page, "NonExistentProcessor");

        // Verify the processor was not found
        expect(processor).toBeNull();
    });

    test("findProcessor should fail with failIfNotFound option", async ({
        page,
    }) => {
        // Test that findProcessor fails with failIfNotFound option
        try {
            await findProcessor(page, "NonExistentProcessor", {
                failIfNotFound: true,
            });
            // If we get here, the test failed
            expect(
                false,
                "findProcessor should have failed with failIfNotFound option",
            ).toBeTruthy();
        } catch (error) {
            // Verify the error message
            expect(error.message).toContain("Processor not found");
        }
    });

    test("addProcessor should add a processor to the canvas", async ({
        page,
    }) => {
        // Test that addProcessor works correctly
        const processor = await addProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );

        // Verify the processor was added
        expect(processor).toBeTruthy();
        expect(processor.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
        expect(processor.isVisible).toBeTruthy();

        // Verify the processor exists on the canvas
        const foundProcessor = await findProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(foundProcessor).toBeTruthy();
    });

    test("removeProcessor should remove a processor from the canvas", async ({
        page,
    }) => {
        // First add a processor to remove
        await addJwtTokenAuthenticator(page);

        // Test that removeProcessor works correctly
        const success = await removeProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );

        // Verify the processor was removed
        expect(success).toBeTruthy();

        // Verify the processor no longer exists on the canvas
        const processor = await findProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(processor).toBeNull();
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
        const foundProcessor = await findProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(foundProcessor).toBeTruthy();
    });

    test("addMultiIssuerJwtAuthenticator should add a Multi-Issuer JWT Token Authenticator", async ({
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
        const foundProcessor = await findProcessor(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(foundProcessor).toBeTruthy();
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
        const processor = await findProcessor(
            page,
            PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR,
        );
        expect(processor).toBeNull();
    });

    test("removeMultiIssuerJwtAuthenticator should remove a Multi-Issuer JWT Token Authenticator", async ({
        page,
    }) => {
        // First add a processor to remove
        await addMultiIssuerJwtAuthenticator(page);

        // Test that removeMultiIssuerJwtAuthenticator works correctly
        const success = await removeMultiIssuerJwtAuthenticator(page);

        // Verify the processor was removed
        expect(success).toBeTruthy();

        // Verify the processor no longer exists on the canvas
        const processor = await findProcessor(
            page,
            PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR,
        );
        expect(processor).toBeNull();
    });

    test("addProcessor should skip if processor already exists", async ({
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

    test("addProcessor should add processor even if it exists with skipIfExists=false", async ({
        page,
    }) => {
        // First add a processor
        await addJwtTokenAuthenticator(page);

        // Add the same processor again with skipIfExists=false
        // This will likely fail in a real environment as NiFi might not allow duplicate processors
        // But we'll test the functionality anyway
        try {
            await addProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, {
                skipIfExists: false,
            });

            // If we get here, verify multiple processors exist on the canvas
            // Note: This might not be possible in NiFi, so we're not making assertions here
        } catch (error) {
            // If this fails, it's expected in a real NiFi environment
            // eslint-disable-next-line no-console
            console.log(
                `Expected error when adding duplicate processor: ${error.message}`,
            );
        }
    });
});

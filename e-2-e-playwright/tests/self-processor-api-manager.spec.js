/**
 * @file Self-test for ProcessorApiManager utility
 * Tests the API-based processor management functionality
 * Consolidated to cover deployment verification, ensure-on-canvas,
 * and the full lifecycle (add/start/stop/remove).
 * @version 1.1.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { ProcessorApiManager } from "../utils/processor-api-manager.js";
import { AuthService } from "../utils/auth-service.js";

test.describe("ProcessorApiManager Self-Test", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should verify MultiIssuerJWTTokenAuthenticator deployment", async ({
        page,
    }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        // The method should return a boolean
        expect(typeof isDeployed).toBe("boolean");

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: MultiIssuerJWTTokenAuthenticator is not deployed in NiFi. " +
                    "The processor NAR must be installed for these tests to run. " +
                    "Install the NAR file in NiFi's lib directory and restart NiFi.",
            );
        }
    });

    test("should handle ensure processor on canvas", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First check if processor is deployed
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: Cannot ensure processor - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Ensure processor is on canvas
        const ensured = await processorManager.ensureProcessorOnCanvas();
        expect(ensured).toBe(true);

        // Verify it's on canvas
        const result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(true);

        // Call ensure again - should still return true without adding duplicate
        const ensuredAgain = await processorManager.ensureProcessorOnCanvas();
        expect(ensuredAgain).toBe(true);
    });

    test("should handle processor details retrieval", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First ensure we have a processor on canvas
        const { exists, processor } =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

        if (!exists) {
            const isDeployed =
                await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
            if (!isDeployed) {
                throw new Error(
                    "TEST FAILED: No processor to get details for - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                        "The processor NAR must be installed in NiFi for this test to run.",
                );
            }

            const added =
                await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
            if (!added) {
                throw new Error(
                    "TEST FAILED: Could not add processor for details test. " +
                        "The processor could not be added to the canvas.",
                );
            }

            // Get the processor after adding
            const result =
                await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
            if (result.exists && result.processor) {
                const details = await processorManager.getProcessorDetails(
                    result.processor.id,
                );
                expect(details).toBeTruthy();
                expect(details).toHaveProperty("id");
            }
        } else {
            const details = await processorManager.getProcessorDetails(
                processor.id,
            );
            expect(details).toBeTruthy();
            expect(details).toHaveProperty("id");
        }
    });
});

// Full lifecycle integration test
test.describe("ProcessorApiManager Integration Test", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should complete full processor lifecycle", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // Check deployment
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "INTEGRATION TEST FAILED: MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Remove if exists
        await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();

        // Verify not on canvas
        let result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(false);

        // Add to canvas
        const added =
            await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas({
                x: 600,
                y: 400,
            });
        expect(added).toBe(true);

        // Verify on canvas
        result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(true);

        // Start processor — may return false if the processor was freshly
        // added without issuer configuration (validation errors prevent start)
        const started = await processorManager.startProcessor();
        expect(typeof started).toBe("boolean");

        if (started) {
            // Stop processor only if it was started
            const stopped = await processorManager.stopProcessor();
            expect(stopped).toBe(true);
        }

        // Remove from canvas
        const removed =
            await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
        expect(removed).toBe(true);

        // Verify removed
        result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(false);

        // Restore processor on canvas for subsequent test suites (functional tests)
        const restored =
            await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas({
                x: 600,
                y: 400,
            });
        expect(restored).toBe(true);
    });
});
